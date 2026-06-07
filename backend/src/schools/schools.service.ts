import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { School } from './entities/school.entity';
import { Student } from './entities/student.entity';
import { Teacher } from './entities/teacher.entity';
import { CreateSchoolDto } from './dto/create-school.dto';
import { UpdateSchoolDto } from './dto/update-school.dto';

@Injectable()
export class SchoolsService {
  constructor(
    @InjectRepository(School)
    private schoolsRepository: Repository<School>,
    @InjectRepository(Student)
    private studentsRepository: Repository<Student>,
    @InjectRepository(Teacher)
    private teachersRepository: Repository<Teacher>,
  ) {}

  async create(createSchoolDto: CreateSchoolDto): Promise<School> {
    const existing = await this.schoolsRepository.findOne({
      where: { code: createSchoolDto.code },
    });
    if (existing) {
      throw new ConflictException('School code already exists');
    }
    const school = this.schoolsRepository.create(createSchoolDto);
    return this.schoolsRepository.save(school);
  }

  async findAll(
    page = 1,
    limit = 20,
    filters?: {
      search?: string;
      district?: string;
      division?: string;
      isActive?: boolean;
    },
  ) {
    const query = this.schoolsRepository.createQueryBuilder('school');

    if (filters?.search) {
      query.where(
        '(school.name ILIKE :search OR school.code ILIKE :search)',
        { search: `%${filters.search}%` },
      );
    }
    if (filters?.district) {
      query.andWhere('school.district = :district', {
        district: filters.district,
      });
    }
    if (filters?.division) {
      query.andWhere('school.division = :division', {
        division: filters.division,
      });
    }
    if (filters?.isActive !== undefined) {
      query.andWhere('school.isActive = :isActive', {
        isActive: filters.isActive,
      });
    }

    query.orderBy('school.name', 'ASC');
    query.skip((page - 1) * limit).take(limit);

    const [data, total] = await query.getManyAndCount();
    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string): Promise<School> {
    const school = await this.schoolsRepository.findOne({
      where: { id },
      relations: ['students', 'teachers'],
    });
    if (!school) {
      throw new NotFoundException('School not found');
    }
    return school;
  }

  async update(id: string, updateSchoolDto: UpdateSchoolDto): Promise<School> {
    const school = await this.schoolsRepository.findOne({ where: { id } });
    if (!school) {
      throw new NotFoundException('School not found');
    }
    Object.assign(school, updateSchoolDto);
    return this.schoolsRepository.save(school);
  }

  async remove(id: string): Promise<void> {
    const school = await this.schoolsRepository.findOne({ where: { id } });
    if (!school) {
      throw new NotFoundException('School not found');
    }
    await this.schoolsRepository.softRemove(school);
  }

  async getSchoolStats(id: string) {
    const school = await this.findOne(id);
    const totalStudents = await this.studentsRepository.count({
      where: { schoolId: id, isActive: true },
    });
    const totalTeachers = await this.teachersRepository.count({
      where: { schoolId: id, isActive: true },
    });

    return {
      school: {
        id: school.id,
        name: school.name,
        code: school.code,
      },
      totalStudents,
      totalTeachers,
    };
  }

  // Student management
  async getStudents(schoolId: string, page = 1, limit = 20) {
    const [data, total] = await this.studentsRepository.findAndCount({
      where: { schoolId },
      skip: (page - 1) * limit,
      take: limit,
      order: { firstName: 'ASC' },
    });
    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // Teacher management
  async getTeachers(schoolId: string, page = 1, limit = 20) {
    const [data, total] = await this.teachersRepository.findAndCount({
      where: { schoolId },
      skip: (page - 1) * limit,
      take: limit,
      order: { firstName: 'ASC' },
    });
    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }
}
