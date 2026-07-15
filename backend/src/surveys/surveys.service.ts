import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Survey, SurveyStatus, LinkedEntityType } from './entities/survey.entity';
import { SurveyField } from './entities/survey-field.entity';
import { SurveySection } from './entities/survey-section.entity';
import { SurveyResponse } from './entities/survey-response.entity';
import { SurveyAnswer } from './entities/survey-answer.entity';
import { SurveyAssignment } from './entities/survey-assignment.entity';
import { SurveyStatusLog } from './entities/survey-status-log.entity';
import { SchoolRecord } from './entities/school-record.entity';
import { SurveyCategory } from './entities/survey-category.entity';
import { CreateSurveyDto } from './dto/create-survey.dto';
import { UpdateSurveyDto } from './dto/update-survey.dto';
import { SubmitSurveyResponseDto } from './dto/submit-response.dto';

@Injectable()
export class SurveysService {
  constructor(
    @InjectRepository(Survey)
    private surveysRepository: Repository<Survey>,
    @InjectRepository(SurveyField)
    private fieldsRepository: Repository<SurveyField>,
    @InjectRepository(SurveySection)
    private sectionsRepository: Repository<SurveySection>,
    @InjectRepository(SurveyResponse)
    private responsesRepository: Repository<SurveyResponse>,
    @InjectRepository(SurveyAnswer)
    private answersRepository: Repository<SurveyAnswer>,
    @InjectRepository(SurveyAssignment)
    private assignmentsRepository: Repository<SurveyAssignment>,
    @InjectRepository(SurveyStatusLog)
    private statusLogRepository: Repository<SurveyStatusLog>,
    @InjectRepository(SchoolRecord)
    private schoolRecordRepository: Repository<SchoolRecord>,
    @InjectRepository(SurveyCategory)
    private categoryRepository: Repository<SurveyCategory>,
  ) {}

  // ===================== Survey CRUD =====================

  async create(
    createSurveyDto: CreateSurveyDto,
    userId: string,
  ): Promise<Survey> {
    const survey = this.surveysRepository.create({
      title: createSurveyDto.title,
      description: createSurveyDto.description,
      category: createSurveyDto.category,
      status: createSurveyDto.status || SurveyStatus.DRAFT,
      startDate: createSurveyDto.startDate
        ? new Date(createSurveyDto.startDate)
        : undefined,
      endDate: createSurveyDto.endDate
        ? new Date(createSurveyDto.endDate)
        : undefined,
      linkedEntityType:
        createSurveyDto.linkedEntityType || LinkedEntityType.NONE,
      createsSchoolRecord: createSurveyDto.createsSchoolRecord || false,
      createdById: userId,
    });

    const savedSurvey = await this.surveysRepository.save(survey);

    // Create sections with fields
    if (createSurveyDto.sections?.length) {
      for (const [sIdx, s] of createSurveyDto.sections.entries()) {
        const section = this.sectionsRepository.create({
          title: s.title,
          description: s.description,
          order: s.order ?? sIdx,
          surveyId: savedSurvey.id,
        });
        const savedSection = await this.sectionsRepository.save(section);

        if (s.fields?.length) {
          const fields = s.fields.map((f, fIdx) =>
            this.fieldsRepository.create({
              label: f.label,
              fieldName: f.fieldName || undefined,
              fieldType: f.fieldType,
              isRequired: f.isRequired || false,
              options: f.options || undefined,
              validationRules: f.validationRules || undefined,
              placeholder: f.placeholder,
              helpText: f.helpText,
              order: f.order ?? fIdx,
              allowedFileTypes: f.allowedFileTypes,
              maxFileSize: f.maxFileSize,
              surveyId: savedSurvey.id,
              sectionId: savedSection.id,
            }),
          );
          await this.fieldsRepository.save(fields);
        }
      }
    }

    // Create standalone fields (no section)
    if (createSurveyDto.fields?.length) {
      const fields = createSurveyDto.fields.map((f, index) =>
        this.fieldsRepository.create({
          label: f.label,
          fieldName: f.fieldName || undefined,
          fieldType: f.fieldType,
          isRequired: f.isRequired || false,
          options: f.options || undefined,
          validationRules: f.validationRules || undefined,
          placeholder: f.placeholder,
          helpText: f.helpText,
          order: f.order ?? index,
          allowedFileTypes: f.allowedFileTypes,
          maxFileSize: f.maxFileSize,
          surveyId: savedSurvey.id,
          sectionId: f.sectionId || undefined,
        }),
      );
      await this.fieldsRepository.save(fields);
    }

    // Create assignments
    if (createSurveyDto.assignments?.length) {
      const assignments = createSurveyDto.assignments.map((a) =>
        this.assignmentsRepository.create({
          surveyId: savedSurvey.id,
          userId: a.userId,
          roleId: a.roleId,
          schoolId: a.schoolId,
          excludeUserIds: a.excludeUserIds || undefined,
        }),
      );
      await this.assignmentsRepository.save(assignments);
    }

    return this.findOne(savedSurvey.id);
  }

  async findAll(
    page = 1,
    limit = 20,
    filters?: {
      category?: string;
      status?: SurveyStatus;
      search?: string;
    },
  ) {
    const query = this.surveysRepository
      .createQueryBuilder('survey')
      .leftJoinAndSelect('survey.fields', 'field')
      .leftJoinAndSelect('survey.sections', 'section')
      .leftJoinAndSelect('survey.createdBy', 'creator')
      .select([
        'survey',
        'field',
        'section',
        'creator.id',
        'creator.firstName',
        'creator.lastName',
      ]);

    if (filters?.category) {
      query.andWhere('survey.category = :category', {
        category: filters.category,
      });
    }
    if (filters?.status) {
      query.andWhere('survey.status = :status', { status: filters.status });
    }
    if (filters?.search) {
      query.andWhere(
        '(survey.title ILIKE :search OR survey.description ILIKE :search)',
        { search: `%${filters.search}%` },
      );
    }

    query
      .orderBy('survey.createdAt', 'DESC')
      .addOrderBy('section.order', 'ASC')
      .addOrderBy('field.order', 'ASC');

    const numPage = Number(page) || 1;
    const numLimit = Number(limit) || 20;
    query.skip((numPage - 1) * numLimit).take(numLimit);

    const [data, total] = await query.getManyAndCount();
    return {
      data,
      meta: {
        total,
        page: numPage,
        limit: numLimit,
        totalPages: Math.ceil(total / numLimit),
      },
    };
  }

  async findOne(id: string): Promise<Survey> {
    const survey = await this.surveysRepository.findOne({
      where: { id },
      relations: [
        'fields',
        'sections',
        'sections.fields',
        'createdBy',
        'assignments',
        'assignments.user',
        'assignments.role',
        'assignments.school',
      ],
      order: {
        sections: { order: 'ASC' },
        fields: { order: 'ASC' },
      },
    });
    if (!survey) {
      throw new NotFoundException('Survey not found');
    }
    return survey;
  }

  async findAssignedSurveys(userId: string, userRoleIds: string[]) {
    const query = this.surveysRepository
      .createQueryBuilder('survey')
      .leftJoinAndSelect('survey.fields', 'field')
      .leftJoinAndSelect('survey.sections', 'section')
      .leftJoin('survey.assignments', 'assignment')
      .where('survey.status = :status', { status: SurveyStatus.PUBLISHED })
      .andWhere(
        '(assignment.userId = :userId OR assignment.roleId IN (:...roleIds))',
        { userId, roleIds: userRoleIds.length ? userRoleIds : ['none'] },
      )
      .andWhere(
        '(survey.endDate IS NULL OR survey.endDate >= :now)',
        { now: new Date() },
      )
      .orderBy('survey.createdAt', 'DESC')
      .addOrderBy('section.order', 'ASC')
      .addOrderBy('field.order', 'ASC');

    return query.getMany();
  }

  async update(
    id: string,
    updateSurveyDto: UpdateSurveyDto,
  ): Promise<Survey> {
    const survey = await this.surveysRepository.findOne({
      where: { id },
      relations: ['fields', 'sections'],
    });
    if (!survey) {
      throw new NotFoundException('Survey not found');
    }

    // Only drafts can have fields/sections edited
    if (
      survey.status !== SurveyStatus.DRAFT &&
      (updateSurveyDto.fields || updateSurveyDto.sections)
    ) {
      throw new ForbiddenException(
        'Only draft surveys can have their fields edited',
      );
    }

    // Update survey properties
    Object.assign(survey, {
      ...(updateSurveyDto.title && { title: updateSurveyDto.title }),
      ...(updateSurveyDto.description !== undefined && {
        description: updateSurveyDto.description,
      }),
      ...(updateSurveyDto.category && { category: updateSurveyDto.category }),
      ...(updateSurveyDto.status && { status: updateSurveyDto.status }),
      ...(updateSurveyDto.startDate && {
        startDate: new Date(updateSurveyDto.startDate),
      }),
      ...(updateSurveyDto.endDate && {
        endDate: new Date(updateSurveyDto.endDate),
      }),
      ...(updateSurveyDto.linkedEntityType !== undefined && {
        linkedEntityType: updateSurveyDto.linkedEntityType,
      }),
      ...(updateSurveyDto.createsSchoolRecord !== undefined && {
        createsSchoolRecord: updateSurveyDto.createsSchoolRecord,
      }),
    });

    await this.surveysRepository.save(survey);

    // Update sections if provided
    if (updateSurveyDto.sections) {
      await this.sectionsRepository.delete({ surveyId: id });
      await this.fieldsRepository.delete({ surveyId: id });

      for (const [sIdx, s] of updateSurveyDto.sections.entries()) {
        const section = this.sectionsRepository.create({
          title: s.title,
          description: s.description,
          order: s.order ?? sIdx,
          surveyId: id,
        });
        const savedSection = await this.sectionsRepository.save(section);

        if (s.fields?.length) {
          const fields = s.fields.map((f, fIdx) =>
            this.fieldsRepository.create({
              label: f.label,
              fieldName: f.fieldName || undefined,
              fieldType: f.fieldType,
              isRequired: f.isRequired || false,
              options: f.options || null,
              validationRules: f.validationRules || null,
              placeholder: f.placeholder,
              helpText: f.helpText,
              order: f.order ?? fIdx,
              allowedFileTypes: f.allowedFileTypes,
              maxFileSize: f.maxFileSize,
              surveyId: id,
              sectionId: savedSection.id,
            }),
          );
          await this.fieldsRepository.save(fields);
        }
      }
    }

    // Update standalone fields if provided (and no sections update)
    if (updateSurveyDto.fields && !updateSurveyDto.sections) {
      await this.fieldsRepository.delete({ surveyId: id });
      const fields = updateSurveyDto.fields.map((f, index) =>
        this.fieldsRepository.create({
          label: f.label,
          fieldName: f.fieldName || undefined,
          fieldType: f.fieldType,
          isRequired: f.isRequired || false,
          options: f.options || null,
          validationRules: f.validationRules || null,
          placeholder: f.placeholder,
          helpText: f.helpText,
          order: f.order ?? index,
          allowedFileTypes: f.allowedFileTypes,
          maxFileSize: f.maxFileSize,
          surveyId: id,
        }),
      );
      await this.fieldsRepository.save(fields);
    }

    // Update assignments if provided
    if (updateSurveyDto.assignments) {
      await this.assignmentsRepository.delete({ surveyId: id });
      const assignments = updateSurveyDto.assignments.map((a) =>
        this.assignmentsRepository.create({
          surveyId: id,
          userId: a.userId,
          roleId: a.roleId,
          schoolId: a.schoolId,
          excludeUserIds: a.excludeUserIds || undefined,
        }),
      );
      await this.assignmentsRepository.save(assignments);
    }

    return this.findOne(id);
  }

  // ===================== Status Management =====================

  async updateStatus(
    id: string,
    newStatus: SurveyStatus,
    userId: string,
  ): Promise<Survey> {
    const survey = await this.surveysRepository.findOne({ where: { id } });
    if (!survey) {
      throw new NotFoundException('Survey not found');
    }

    const validTransitions: Record<SurveyStatus, SurveyStatus[]> = {
      [SurveyStatus.DRAFT]: [SurveyStatus.PUBLISHED],
      [SurveyStatus.PUBLISHED]: [SurveyStatus.CLOSED],
      [SurveyStatus.CLOSED]: [SurveyStatus.ARCHIVED],
      [SurveyStatus.ARCHIVED]: [],
    };

    if (!validTransitions[survey.status]?.includes(newStatus)) {
      throw new BadRequestException(
        `Cannot transition from "${survey.status}" to "${newStatus}"`,
      );
    }

    const fromStatus = survey.status;

    // Set wasPublished flag when first published
    if (newStatus === SurveyStatus.PUBLISHED) {
      survey.wasPublished = true;
    }

    survey.status = newStatus;
    await this.surveysRepository.save(survey);

    // Log the status change
    const log = this.statusLogRepository.create({
      surveyId: id,
      fromStatus: fromStatus as string,
      toStatus: newStatus as string,
      changedById: userId,
    });
    await this.statusLogRepository.save(log);

    return this.findOne(id);
  }

  async getStatusLogs(surveyId: string): Promise<SurveyStatusLog[]> {
    return this.statusLogRepository.find({
      where: { surveyId },
      relations: ['changedBy'],
      order: { changedAt: 'DESC' },
    });
  }

  // ===================== Delete (Soft) =====================

  async remove(id: string): Promise<void> {
    const survey = await this.surveysRepository.findOne({ where: { id } });
    if (!survey) {
      throw new NotFoundException('Survey not found');
    }

    if (survey.wasPublished) {
      throw new ForbiddenException(
        'This survey was published and can never be deleted.',
      );
    }

    await this.surveysRepository.softRemove(survey);
  }

  // ===================== Assignment Management =====================

  async addAssignment(
    surveyId: string,
    assignment: {
      userId?: string;
      roleId?: string;
      schoolId?: string;
      excludeUserIds?: string[];
    },
  ): Promise<SurveyAssignment> {
    const survey = await this.surveysRepository.findOne({
      where: { id: surveyId },
    });
    if (!survey) {
      throw new NotFoundException('Survey not found');
    }
    const entity = this.assignmentsRepository.create({
      surveyId,
      userId: assignment.userId,
      roleId: assignment.roleId,
      schoolId: assignment.schoolId,
      excludeUserIds: assignment.excludeUserIds || undefined,
    });
    return this.assignmentsRepository.save(entity);
  }

  // Bulk add multiple assignments at once
  async addBulkAssignments(
    surveyId: string,
    assignments: Array<{
      userId?: string;
      roleId?: string;
      schoolId?: string;
      excludeUserIds?: string[];
    }>,
  ): Promise<SurveyAssignment[]> {
    const survey = await this.surveysRepository.findOne({
      where: { id: surveyId },
    });
    if (!survey) {
      throw new NotFoundException('Survey not found');
    }

    const entities = assignments.map((a) =>
      this.assignmentsRepository.create({
        surveyId,
        userId: a.userId,
        roleId: a.roleId,
        schoolId: a.schoolId,
        excludeUserIds: a.excludeUserIds || undefined,
      }),
    );
    return this.assignmentsRepository.save(entities);
  }

  async removeAssignment(assignmentId: string): Promise<void> {
    const assignment = await this.assignmentsRepository.findOne({
      where: { id: assignmentId },
    });
    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }
    await this.assignmentsRepository.remove(assignment);
  }

  async getAssignments(surveyId: string): Promise<SurveyAssignment[]> {
    return this.assignmentsRepository.find({
      where: { surveyId },
      relations: ['user', 'role', 'school'],
    });
  }

  // ===================== Copy/Duplicate =====================

  async copySurvey(id: string, userId: string): Promise<Survey> {
    const original = await this.findOne(id);

    const newSurvey = this.surveysRepository.create({
      title: `${original.title} (Copy)`,
      description: original.description,
      category: original.category,
      status: SurveyStatus.DRAFT,
      linkedEntityType: original.linkedEntityType,
      createsSchoolRecord: original.createsSchoolRecord,
      createdById: userId,
    });
    const saved = await this.surveysRepository.save(newSurvey);

    // Copy sections and fields
    if (original.sections?.length) {
      for (const origSection of original.sections) {
        const section = this.sectionsRepository.create({
          title: origSection.title,
          description: origSection.description,
          order: origSection.order,
          surveyId: saved.id,
        });
        const savedSection = await this.sectionsRepository.save(section);

        if (origSection.fields?.length) {
          const fields = origSection.fields.map((f) =>
            this.fieldsRepository.create({
              label: f.label,
              fieldType: f.fieldType,
              isRequired: f.isRequired,
              options: f.options,
              validationRules: f.validationRules,
              placeholder: f.placeholder,
              helpText: f.helpText,
              order: f.order,
              allowedFileTypes: f.allowedFileTypes,
              maxFileSize: f.maxFileSize,
              surveyId: saved.id,
              sectionId: savedSection.id,
            }),
          );
          await this.fieldsRepository.save(fields);
        }
      }
    }

    // Copy standalone fields
    const standaloneFields = (original.fields || []).filter(
      (f) => !f.sectionId,
    );
    if (standaloneFields.length) {
      const fields = standaloneFields.map((f) =>
        this.fieldsRepository.create({
          label: f.label,
          fieldType: f.fieldType,
          isRequired: f.isRequired,
          options: f.options,
          validationRules: f.validationRules,
          placeholder: f.placeholder,
          helpText: f.helpText,
          order: f.order,
          allowedFileTypes: f.allowedFileTypes,
          maxFileSize: f.maxFileSize,
          surveyId: saved.id,
        }),
      );
      await this.fieldsRepository.save(fields);
    }

    return this.findOne(saved.id);
  }

  // ===================== Survey Responses =====================

  async submitResponse(
    submitDto: SubmitSurveyResponseDto,
    userId: string,
  ): Promise<SurveyResponse> {
    const survey = await this.surveysRepository.findOne({
      where: { id: submitDto.surveyId },
      relations: ['fields', 'sections', 'sections.fields'],
    });
    if (!survey) {
      throw new NotFoundException('Survey not found');
    }
    if (survey.status !== SurveyStatus.PUBLISHED) {
      throw new ForbiddenException('Survey is not accepting responses');
    }

    // If school record linkage required, validate
    if (
      survey.linkedEntityType === LinkedEntityType.SCHOOL_RECORD &&
      !survey.createsSchoolRecord &&
      !submitDto.schoolRecordId
    ) {
      throw new BadRequestException(
        'This survey requires selecting a school record',
      );
    }

    const isDraft = submitDto.isDraft === true;

    // Check if user has an existing draft for this survey
    let existingDraft: SurveyResponse | null = null;
    if (submitDto.responseId) {
      existingDraft = await this.responsesRepository.findOne({
        where: { id: submitDto.responseId, respondentId: userId },
      });
    }

    if (existingDraft) {
      // Update existing draft
      existingDraft.isComplete = !isDraft;
      existingDraft.schoolRecordId = submitDto.schoolRecordId || existingDraft.schoolRecordId;
      existingDraft.metadata = submitDto.metadata || existingDraft.metadata;
      await this.responsesRepository.save(existingDraft);

      // Replace answers
      await this.answersRepository.delete({ responseId: existingDraft.id });
      const answers = submitDto.answers.map((a) =>
        this.answersRepository.create({
          responseId: existingDraft!.id,
          fieldId: a.fieldId,
          textValue: a.textValue,
          numberValue: a.numberValue,
          booleanValue: a.booleanValue,
          jsonValue: a.jsonValue,
          fileUrl: a.fileUrl,
        }),
      );
      await this.answersRepository.save(answers);

      // Create school record on final submit
      if (!isDraft && survey.createsSchoolRecord) {
        await this.createSchoolRecordFromResponse(survey, submitDto, existingDraft.id, userId);
      }

      return this.getResponse(existingDraft.id);
    }

    // Create new response
    const response = this.responsesRepository.create({
      surveyId: submitDto.surveyId,
      respondentId: userId,
      schoolRecordId: submitDto.schoolRecordId || undefined,
      isComplete: !isDraft,
      metadata: submitDto.metadata,
    });

    const savedResponse = await this.responsesRepository.save(response);

    const answers = submitDto.answers.map((a) =>
      this.answersRepository.create({
        responseId: savedResponse.id,
        fieldId: a.fieldId,
        textValue: a.textValue,
        numberValue: a.numberValue,
        booleanValue: a.booleanValue,
        jsonValue: a.jsonValue,
        fileUrl: a.fileUrl,
      }),
    );
    await this.answersRepository.save(answers);

    // Create school record on final submit
    if (!isDraft && survey.createsSchoolRecord) {
      await this.createSchoolRecordFromResponse(survey, submitDto, savedResponse.id, userId);
    }

    return this.getResponse(savedResponse.id);
  }

  private async createSchoolRecordFromResponse(
    survey: Survey,
    submitDto: SubmitSurveyResponseDto,
    responseId: string,
    userId: string,
  ) {
    // Get all fields from sections too
    const allFields = [
      ...(survey.fields || []),
      ...(survey.sections?.flatMap((s) => s.fields || []) || []),
    ];

    const nameField = allFields.find(
      (f) =>
        f.label.toLowerCase().includes('school name') ||
        f.label.toLowerCase().includes('name of school'),
    );
    const nameAnswer = nameField
      ? submitDto.answers.find((a) => a.fieldId === nameField.id)
      : undefined;
    const recordName =
      nameAnswer?.textValue || `School Record - ${survey.title}`;

    const schoolRecord = this.schoolRecordRepository.create({
      name: recordName,
      createdById: userId,
      sourceSurveyId: submitDto.surveyId,
      sourceResponseId: responseId,
      metadata: {
        surveyTitle: survey.title,
        submittedAt: new Date().toISOString(),
      },
    });
    await this.schoolRecordRepository.save(schoolRecord);
  }

  // Get draft response for a user on a specific survey
  async getUserDraftResponse(
    surveyId: string,
    userId: string,
  ): Promise<SurveyResponse | null> {
    return this.responsesRepository.findOne({
      where: { surveyId, respondentId: userId, isComplete: false },
      relations: ['answers', 'answers.field'],
      order: { createdAt: 'DESC' },
    });
  }

  async getResponses(
    surveyId: string,
    page = 1,
    limit = 20,
    filters?: {
      startDate?: string;
      endDate?: string;
    },
  ) {
    const query = this.responsesRepository
      .createQueryBuilder('response')
      .leftJoinAndSelect('response.answers', 'answer')
      .leftJoinAndSelect('answer.field', 'field')
      .leftJoinAndSelect('response.respondent', 'respondent')
      .select([
        'response',
        'answer',
        'field.id',
        'field.label',
        'field.fieldType',
        'respondent.id',
        'respondent.firstName',
        'respondent.lastName',
        'respondent.email',
      ])
      .where('response.surveyId = :surveyId', { surveyId })
      .andWhere('response.isComplete = :isComplete', { isComplete: true });

    if (filters?.startDate) {
      query.andWhere('response.createdAt >= :startDate', {
        startDate: filters.startDate,
      });
    }
    if (filters?.endDate) {
      query.andWhere('response.createdAt <= :endDate', {
        endDate: filters.endDate,
      });
    }

    query.orderBy('response.createdAt', 'DESC');
    const numPage = Number(page) || 1;
    const numLimit = Number(limit) || 20;
    query.skip((numPage - 1) * numLimit).take(numLimit);

    const [data, total] = await query.getManyAndCount();
    return {
      data,
      meta: {
        total,
        page: numPage,
        limit: numLimit,
        totalPages: Math.ceil(total / numLimit),
      },
    };
  }

  async getAllResponses(
    page = 1,
    limit = 20,
    filters?: {
      startDate?: string;
      endDate?: string;
    },
  ) {
    const query = this.responsesRepository
      .createQueryBuilder('response')
      .leftJoinAndSelect('response.survey', 'survey')
      .leftJoinAndSelect('response.respondent', 'respondent')
      .select([
        'response',
        'survey.id',
        'survey.title',
        'respondent.id',
        'respondent.firstName',
        'respondent.lastName',
        'respondent.email',
      ])
      .where('response.isComplete = :isComplete', { isComplete: true });

    if (filters?.startDate) {
      query.andWhere('response.createdAt >= :startDate', {
        startDate: filters.startDate,
      });
    }
    if (filters?.endDate) {
      query.andWhere('response.createdAt <= :endDate', {
        endDate: filters.endDate,
      });
    }

    query.orderBy('response.createdAt', 'DESC');
    const numPage = Number(page) || 1;
    const numLimit = Number(limit) || 20;
    query.skip((numPage - 1) * numLimit).take(numLimit);

    const [data, total] = await query.getManyAndCount();
    return {
      data,
      meta: {
        total,
        page: numPage,
        limit: numLimit,
        totalPages: Math.ceil(total / numLimit),
      },
    };
  }

  async getResponse(id: string): Promise<SurveyResponse> {
    const response = await this.responsesRepository.findOne({
      where: { id },
      relations: ['answers', 'answers.field', 'respondent', 'survey'],
    });
    if (!response) {
      throw new NotFoundException('Response not found');
    }
    return response;
  }

  // Export responses as CSV
  async exportResponsesCsv(surveyId: string): Promise<string> {
    const survey = await this.findOne(surveyId);
    // Combine section fields and standalone fields
    const allFields = [
      ...(survey.sections?.flatMap((s) =>
        (s.fields || []).sort((a, b) => a.order - b.order),
      ) || []),
      ...(survey.fields?.filter((f) => !f.sectionId)?.sort((a, b) => a.order - b.order) || []),
    ];

    const { data: responses } = await this.getResponses(surveyId, 1, 10000);

    let csv = '\uFEFF';
    const headers = [
      'Response ID',
      'Respondent Name',
      'Respondent Email',
      'Submitted At',
      ...allFields.map((f) => f.label),
    ];
    csv += headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(',') + '\n';

    for (const resp of responses) {
      const row = [
        resp.id,
        resp.respondent
          ? `${resp.respondent.firstName} ${resp.respondent.lastName}`
          : 'Anonymous',
        resp.respondent?.email || '',
        resp.createdAt ? new Date(resp.createdAt).toISOString() : '',
      ];

      for (const field of allFields) {
        const answer = resp.answers?.find((a) => a.fieldId === field.id);
        if (!answer) {
          row.push('');
          continue;
        }
        const value =
          answer.textValue ||
          (answer.numberValue !== undefined && answer.numberValue !== null
            ? String(answer.numberValue)
            : '') ||
          (answer.booleanValue !== undefined
            ? answer.booleanValue
              ? 'Yes'
              : 'No'
            : '') ||
          (answer.jsonValue ? JSON.stringify(answer.jsonValue) : '') ||
          answer.fileUrl ||
          '';
        row.push(value);
      }

      csv +=
        row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',') + '\n';
    }

    return csv;
  }

  // ===================== Categories =====================

  async getCategories(): Promise<SurveyCategory[]> {
    return this.categoryRepository.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
  }

  async getAllCategories(): Promise<SurveyCategory[]> {
    return this.categoryRepository.find({
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
  }

  async createCategory(data: {
    name: string;
    description?: string;
    sortOrder?: number;
  }): Promise<SurveyCategory> {
    const existing = await this.categoryRepository.findOne({
      where: { name: data.name },
    });
    if (existing) {
      throw new BadRequestException('Category already exists');
    }
    const category = this.categoryRepository.create({
      name: data.name,
      description: data.description,
      sortOrder: data.sortOrder || 0,
    });
    return this.categoryRepository.save(category);
  }

  async updateCategory(
    id: string,
    data: { name?: string; description?: string; sortOrder?: number; isActive?: boolean },
  ): Promise<SurveyCategory> {
    const category = await this.categoryRepository.findOne({ where: { id } });
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    if (data.name && data.name !== category.name) {
      const existing = await this.categoryRepository.findOne({
        where: { name: data.name },
      });
      if (existing) {
        throw new BadRequestException('Category name already exists');
      }
    }
    Object.assign(category, data);
    return this.categoryRepository.save(category);
  }

  async deleteCategory(id: string): Promise<void> {
    const category = await this.categoryRepository.findOne({ where: { id } });
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    await this.categoryRepository.softRemove(category);
  }

  // ===================== Stats =====================

  async getSurveyStats(surveyId: string) {
    const totalResponses = await this.responsesRepository.count({
      where: { surveyId, isComplete: true },
    });

    const survey = await this.findOne(surveyId);

    return {
      surveyId,
      title: survey.title,
      totalResponses,
      totalFields: survey.fields?.length || 0,
      totalSections: survey.sections?.length || 0,
      status: survey.status,
      wasPublished: survey.wasPublished,
      linkedEntityType: survey.linkedEntityType,
      createsSchoolRecord: survey.createsSchoolRecord,
    };
  }

  // ===================== School Records =====================

  async getSchoolRecords(userId: string): Promise<SchoolRecord[]> {
    return this.schoolRecordRepository.find({
      where: { createdById: userId, isActive: true },
      relations: ['school'],
      order: { createdAt: 'DESC' },
    });
  }

  async getAllSchoolRecords(): Promise<SchoolRecord[]> {
    return this.schoolRecordRepository.find({
      where: { isActive: true },
      relations: ['school', 'createdBy'],
      order: { createdAt: 'DESC' },
    });
  }

  async getSchoolRecord(id: string): Promise<SchoolRecord> {
    const record = await this.schoolRecordRepository.findOne({
      where: { id },
      relations: ['school', 'createdBy'],
    });
    if (!record) {
      throw new NotFoundException('School record not found');
    }
    return record;
  }

  async getSchoolRecordResponses(schoolRecordId: string) {
    return this.responsesRepository.find({
      where: { schoolRecordId, isComplete: true },
      relations: ['survey', 'answers', 'answers.field', 'respondent'],
      order: { createdAt: 'DESC' },
    });
  }

  // Transfer school record ownership (Super Admin only)
  async transferSchoolRecordOwnership(
    recordId: string,
    newOwnerId: string,
  ): Promise<SchoolRecord> {
    const record = await this.schoolRecordRepository.findOne({
      where: { id: recordId },
    });
    if (!record) {
      throw new NotFoundException('School record not found');
    }
    record.createdById = newOwnerId;
    return this.schoolRecordRepository.save(record);
  }
}
