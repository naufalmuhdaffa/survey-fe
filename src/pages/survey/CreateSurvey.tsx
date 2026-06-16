import { useEffect, useMemo, useRef, useState } from "react";
import { Sidebar } from "../../components/sidebar";
import { Topbar } from "../../components/topbar";
import adminAvatar from "../../assets/home/home-admin-avatar.png";
import addOptionIcon from "../../assets/survey/create/create-add-option.svg";
import arrowLeftIcon from "../../assets/survey/create/create-arrow-left.svg";
import arrowRightIcon from "../../assets/survey/create/create-arrow-right.svg";
import calendarIcon from "../../assets/survey/create/create-calendar.svg";
import deleteIcon from "../../assets/survey/create/create-delete.svg";
import editIcon from "../../assets/survey/create/create-edit.svg";
import emptyQuestionIcon from "../../assets/survey/create/create-empty-question.svg";
import infoIcon from "../../assets/survey/create/create-info.svg";
import pagePlusIcon from "../../assets/survey/create/create-plus-dark.svg";
import plusIcon from "../../assets/survey/create/create-plus.svg";
import publishIcon from "../../assets/survey/create/create-publish.svg";
import stepCheckIcon from "../../assets/survey/create/create-step-check.svg";
import targetIcon from "../../assets/survey/create/create-target.svg";
import uploadIcon from "../../assets/survey/create/create-upload.svg";
import defaultThumbnailPreview from "../../assets/survey/create-thumbnail-preview.png";
import { API_BASE_URL } from "../../lib/api";
import "../../styles/survey/CreateSurvey.scss";

const AUTH_TOKEN_KEY = "survey_auth_token";
const DRAFT_STORAGE_KEY = "survey_create_draft";
const MAX_QUESTION_DEPTH = 3;

type CreateSurveyProps = {
  accountDescription?: string;
  accountName?: string;
  editSurveyId?: number | null;
  isAuthenticated: boolean;
  mode?: "create" | "edit";
  onAuthAction?: () => void;
  onBackHome?: () => void;
  onOpenManageSurveys?: () => void;
  onOpenProfile?: () => void;
  onUnauthorized?: () => void;
};

type BuilderStep = 1 | 2 | 3;
type AudienceMode = "all" | "limited";
type FeedbackType = "error" | "info" | "success";
type QuestionType =
  | "checkbox"
  | "dropdown"
  | "free_text"
  | "radio_button";

type Feedback = {
  message: string;
  type: FeedbackType;
};

type StepRoute = "informasi-umum" | "isi-survey" | "pengaturan";

type SurveyInfo = {
  audienceMode: AudienceMode;
  closesAt: string;
  description: string;
  estimatedTime: string;
  instructions: string;
  opensAt: string;
  positions: string[];
  title: string;
};

type QuestionOption = {
  id?: number;
  localId: string;
  text: string;
};

type SurveyQuestion = {
  id?: number;
  isRequired: boolean;
  localId: string;
  options: QuestionOption[];
  page: number;
  parentOptionId?: number | null;
  parentOptionLocalId?: string | null;
  text: string;
  type: QuestionType;
};

type SurveyStatus = "closed" | "draft" | "open" | "upcoming" | string;

type DraftStorage = {
  activePage?: number;
  questions?: SurveyQuestion[];
  sectionTitle?: string;
  sectionTitles?: Record<string, string>;
  surveyId?: number | null;
  surveyInfo?: SurveyInfo;
};

type ApiResult<TData = unknown> = {
  data?: TData;
  message?: string;
  status?: string;
};

type IdResult = {
  id?: number | string;
};

type FieldErrors = Partial<Record<keyof SurveyInfo | "questions", string>>;

type UploadResult = {
  thumbnail_path?: string;
};

type SurveyDetailOption = {
  id: number | string;
  option_order?: number | string | null;
  option_text?: string | null;
};

type SurveyDetailQuestion = {
  id: number | string;
  is_required?: boolean | number | string | null;
  options?: SurveyDetailOption[];
  page?: number | string | null;
  parent_option_id?: number | string | null;
  question_order?: number | string | null;
  question_text?: string | null;
  question_type?: QuestionType | string | null;
};

type SurveyDetailPage = {
  page?: number | string | null;
  questions?: SurveyDetailQuestion[];
  section?: string | null;
};

type SurveyDetail = {
  closes_at?: string | null;
  description?: string | null;
  estimated_time?: number | string | null;
  id?: number | string;
  instructions?: string | null;
  opens_at?: string | null;
  pages?: SurveyDetailPage[];
  restrictions?: string[] | null;
  status?: SurveyStatus | null;
  thumbnail_path?: string | null;
  title?: string | null;
};

type OptionIdsByLocalId = Map<string, number>;

const stepRoutes: Record<BuilderStep, StepRoute> = {
  1: "informasi-umum",
  2: "isi-survey",
  3: "pengaturan",
};

const routeSteps: Record<StepRoute, BuilderStep> = {
  "informasi-umum": 1,
  "isi-survey": 2,
  pengaturan: 3,
};

class UnauthorizedError extends Error {
  constructor() {
    super("Sesi login berakhir. Silakan login kembali.");
  }
}

const questionTypes: Array<{ label: string; value: QuestionType }> = [
  { label: "Jawaban Singkat (Text)", value: "free_text" },
  { label: "Radio Button", value: "radio_button" },
  { label: "Kotak Centang (Checkbox)", value: "checkbox" },
  { label: "Dropdown Menu", value: "dropdown" },
];

const positionOptions = [
  {
    description: "Mencakup semua responden, termasuk ASN dan Non-ASN.",
    label: "Masyarakat Umum",
    value: "public",
  },
  {
    description: "Hanya user dengan status Pegawai ASN.",
    label: "Pegawai ASN",
    value: "asn",
  },
  {
    description: "Hanya user dengan status Pegawai Non-ASN.",
    label: "Pegawai Non-ASN",
    value: "non_asn",
  },
];

const defaultSurveyInfo: SurveyInfo = {
  audienceMode: "all",
  closesAt: "",
  description: "",
  estimatedTime: "",
  instructions: "",
  opensAt: "",
  positions: [],
  title: "",
};

const createLocalId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const createOption = (text = ""): QuestionOption => ({
  localId: createLocalId(),
  text,
});

const createQuestion = (
  overrides: Partial<SurveyQuestion> = {},
): SurveyQuestion => ({
  isRequired: true,
  localId: createLocalId(),
  options: [createOption("Opsi 1"), createOption("Opsi 2")],
  page: 1,
  parentOptionId: null,
  parentOptionLocalId: null,
  text: "",
  type: "radio_button",
  ...overrides,
});

const createConditionalQuestion = (
  parentOption: QuestionOption,
  page: number,
): SurveyQuestion =>
  createQuestion({
    options: [],
    page,
    parentOptionId: parentOption.id ?? null,
    parentOptionLocalId: parentOption.localId,
    type: "free_text",
  });

const getStoredToken = () =>
  localStorage.getItem(AUTH_TOKEN_KEY) ?? sessionStorage.getItem(AUTH_TOKEN_KEY);

const authHeaders = (): Record<string, string> => {
  const token = getStoredToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const isChoiceQuestion = (type: QuestionType) =>
  ["checkbox", "dropdown", "radio_button"].includes(type);

const isConditionalQuestion = (question: SurveyQuestion) =>
  Boolean(question.parentOptionLocalId || question.parentOptionId);

const isQuestionLinkedToOption = (
  question: SurveyQuestion,
  option: QuestionOption,
) =>
  question.parentOptionLocalId === option.localId ||
  (typeof option.id === "number" && question.parentOptionId === option.id);

const getOptionOwnerQuestion = (
  questions: SurveyQuestion[],
  option: QuestionOption,
) =>
  questions.find((question) =>
    question.options.some(
      (item) =>
        item.localId === option.localId ||
        (typeof item.id === "number" && item.id === option.id),
    ),
  );

const getParentQuestion = (
  questions: SurveyQuestion[],
  question: SurveyQuestion,
) =>
  questions.find((candidate) =>
    candidate.options.some(
      (option) =>
        option.localId === question.parentOptionLocalId ||
        (typeof option.id === "number" && option.id === question.parentOptionId),
    ),
  );

const getQuestionDepth = (
  questions: SurveyQuestion[],
  question: SurveyQuestion,
) => {
  const visitedQuestionIds = new Set<string>();
  let currentQuestion: SurveyQuestion | undefined = question;
  let depth = 1;

  while (
    currentQuestion &&
    isConditionalQuestion(currentQuestion) &&
    !visitedQuestionIds.has(currentQuestion.localId)
  ) {
    visitedQuestionIds.add(currentQuestion.localId);
    currentQuestion = getParentQuestion(questions, currentQuestion);

    if (currentQuestion) {
      depth += 1;
    }
  }

  return depth;
};

const orderQuestionsForPersistence = (questions: SurveyQuestion[]) => {
  const orderedQuestions: SurveyQuestion[] = [];
  const visitedQuestionIds = new Set<string>();

  const appendQuestion = (question: SurveyQuestion) => {
    if (visitedQuestionIds.has(question.localId)) {
      return;
    }

    visitedQuestionIds.add(question.localId);
    orderedQuestions.push(question);

    question.options.forEach((option) => {
      questions
        .filter((candidate) => isQuestionLinkedToOption(candidate, option))
        .forEach(appendQuestion);
    });
  };

  questions
    .filter((question) => !isConditionalQuestion(question))
    .forEach(appendQuestion);

  questions.forEach(appendQuestion);

  return orderedQuestions;
};

const removeQuestionsWithDescendants = (
  questions: SurveyQuestion[],
  rootQuestion: SurveyQuestion,
) => {
  const removedQuestionLocalIds = new Set([rootQuestion.localId]);
  const removedOptionLocalIds = new Set(
    rootQuestion.options.map((option) => option.localId),
  );
  const removedOptionIds = new Set(
    rootQuestion.options
      .map((option) => option.id)
      .filter((optionId): optionId is number => typeof optionId === "number"),
  );

  let hasNewDescendant = true;

  while (hasNewDescendant) {
    hasNewDescendant = false;

    questions.forEach((question) => {
      const parentOptionMatches =
        (question.parentOptionLocalId &&
          removedOptionLocalIds.has(question.parentOptionLocalId)) ||
        (question.parentOptionId &&
          removedOptionIds.has(question.parentOptionId));

      if (!parentOptionMatches || removedQuestionLocalIds.has(question.localId)) {
        return;
      }

      removedQuestionLocalIds.add(question.localId);
      question.options.forEach((option) => {
        removedOptionLocalIds.add(option.localId);

        if (option.id) {
          removedOptionIds.add(option.id);
        }
      });
      hasNewDescendant = true;
    });
  }

  return questions.filter(
    (question) => !removedQuestionLocalIds.has(question.localId),
  );
};

const removeQuestionsLinkedToOptionWithDescendants = (
  questions: SurveyQuestion[],
  option: QuestionOption,
) =>
  questions
    .filter((question) => isQuestionLinkedToOption(question, option))
    .reduce(
      (nextQuestions, linkedQuestion) =>
        removeQuestionsWithDescendants(nextQuestions, linkedQuestion),
      questions,
    );

const removeOverDepthConditionalQuestions = (questions: SurveyQuestion[]) =>
  questions
    .filter(
      (question) => getQuestionDepth(questions, question) > MAX_QUESTION_DEPTH,
    )
    .reduce(
      (nextQuestions, nestedQuestion) =>
        removeQuestionsWithDescendants(nextQuestions, nestedQuestion),
      questions,
    );

const toApiDateTime = (value: string) => {
  if (!value) {
    return null;
  }

  return value.replace("T", " ") + (value.length === 16 ? ":00" : "");
};

const toDateTimeInputValue = (value?: string | null) => {
  if (!value) {
    return "";
  }

  const normalizedValue = value.replace(" ", "T");
  return normalizedValue.slice(0, 16);
};

const toNumberOrNull = (value: string) => {
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : null;
};

const parseOptionalNumber = (value: number | string | null | undefined) => {
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : null;
};

const getDraftStorageKey = (mode: "create" | "edit", surveyId?: number | null) =>
  mode === "edit" && surveyId ? `${DRAFT_STORAGE_KEY}_${surveyId}` : DRAFT_STORAGE_KEY;

const readStoredDraft = (storageKey = DRAFT_STORAGE_KEY): DraftStorage => {
  try {
    const rawDraft = localStorage.getItem(storageKey);
    return rawDraft ? (JSON.parse(rawDraft) as DraftStorage) : {};
  } catch {
    return {};
  }
};

const getStepFromUrl = (): BuilderStep => {
  const [, route] =
    window.location.pathname.match(/\/surveys\/(?:create|edit\/\d+)\/([^/]+)/) ??
    [];

  if (route && route in routeSteps) {
    return routeSteps[route as StepRoute];
  }

  return 1;
};

const getQuestionPageFromUrl = (fallbackPage = 1) => {
  const [, route, page] =
    window.location.pathname.match(
      /\/surveys\/(?:create|edit\/\d+)\/([^/]+)\/(\d+)/,
    ) ?? [];

  if (route !== stepRoutes[2]) {
    return fallbackPage;
  }

  const parsedPage = Number(page);
  return Number.isFinite(parsedPage) && parsedPage > 0
    ? parsedPage
    : fallbackPage;
};

const syncStepUrl = (
  basePath: string,
  step: BuilderStep,
  activePage = 1,
  replace = false,
) => {
  const url = new URL(window.location.href);
  url.pathname =
    step === 2
      ? `${basePath}/${stepRoutes[step]}/${Math.max(1, activePage)}`
      : `${basePath}/${stepRoutes[step]}`;

  const nextUrl = `${url.pathname}${url.search}${url.hash}`;
  const currentUrl =
    `${window.location.pathname}${window.location.search}${window.location.hash}`;

  if (nextUrl === currentUrl) {
    return;
  }

  if (replace) {
    window.history.replaceState({}, "", nextUrl);
    return;
  }

  window.history.pushState({}, "", nextUrl);
};

const getApiMessage = async (response: Response, fallback: string) => {
  try {
    const result = (await response.json()) as ApiResult;
    return result.message ?? fallback;
  } catch {
    return fallback;
  }
};

const requestJson = async <TData,>(
  path: string,
  options: RequestInit,
  fallbackMessage: string,
): Promise<ApiResult<TData>> => {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");

  Object.entries(authHeaders()).forEach(([key, value]) => {
    headers.set(key, value);
  });

  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: "include",
    ...options,
    headers,
  });

  if (response.status === 401) {
    throw new UnauthorizedError();
  }

  if (!response.ok) {
    throw new Error(await getApiMessage(response, fallbackMessage));
  }

  return (await response.json()) as ApiResult<TData>;
};

const requestFormData = async <TData,>(
  path: string,
  formData: FormData,
  fallbackMessage: string,
): Promise<ApiResult<TData>> => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    body: formData,
    credentials: "include",
    headers: authHeaders(),
    method: "POST",
  });

  if (response.status === 401) {
    throw new UnauthorizedError();
  }

  if (!response.ok) {
    throw new Error(await getApiMessage(response, fallbackMessage));
  }

  return (await response.json()) as ApiResult<TData>;
};

const buildSurveyPayload = (surveyInfo: SurveyInfo, status = "draft") => ({
  closes_at: toApiDateTime(surveyInfo.closesAt),
  description: surveyInfo.description.trim(),
  estimated_time: toNumberOrNull(surveyInfo.estimatedTime),
  instructions: surveyInfo.instructions.trim(),
  opens_at: toApiDateTime(surveyInfo.opensAt),
  position:
    surveyInfo.audienceMode === "all"
      ? []
      : Array.from(new Set(surveyInfo.positions)),
  status,
  title: surveyInfo.title.trim(),
});

const getPublishStatus = (opensAt: string) => {
  if (!opensAt) {
    return "open";
  }

  return new Date(opensAt).getTime() > Date.now() ? "upcoming" : "open";
};

const validQuestionTypes = new Set<QuestionType>(
  questionTypes.map((type) => type.value),
);

const normalizeQuestionType = (type?: string | null): QuestionType =>
  type && validQuestionTypes.has(type as QuestionType)
    ? (type as QuestionType)
    : "free_text";

const normalizeRequiredFlag = (
  value: boolean | number | string | null | undefined,
) => value === true || value === 1 || value === "1" || value === "true";

const resolveThumbnailUrl = (thumbnailPath?: string | null) => {
  if (!thumbnailPath) {
    return defaultThumbnailPreview;
  }

  if (/^https?:\/\//i.test(thumbnailPath)) {
    return thumbnailPath;
  }

  return `${API_BASE_URL}${thumbnailPath.startsWith("/") ? "" : "/"}${thumbnailPath}`;
};

const normalizeSurveyDetail = (detail: SurveyDetail) => {
  const restrictions = Array.isArray(detail.restrictions)
    ? detail.restrictions.filter((position): position is string =>
        typeof position === "string",
      )
    : [];
  const isPublicAudience =
    restrictions.length === 0 || restrictions.includes("public");
  const sectionTitles = new Map<number, string>();
  const questions: SurveyQuestion[] = [];

  (detail.pages ?? []).forEach((page) => {
    const pageNumber = Math.max(1, Number(page.page) || 1);

    sectionTitles.set(pageNumber, page.section ?? "");

    (page.questions ?? []).forEach((question, questionIndex) => {
      const questionId = parseOptionalNumber(question.id);
      const questionType = normalizeQuestionType(question.question_type);

      questions.push({
        id: questionId ?? undefined,
        isRequired: normalizeRequiredFlag(question.is_required),
        localId: questionId ? `question-${questionId}` : createLocalId(),
        options: isChoiceQuestion(questionType)
          ? (question.options ?? []).map((option, optionIndex) => {
              const optionId = parseOptionalNumber(option.id);

              return {
                id: optionId ?? undefined,
                localId: optionId ? `option-${optionId}` : createLocalId(),
                text:
                  option.option_text?.trim() ||
                  `Pilihan ${optionIndex + 1}`,
              };
            })
          : [],
        page: Math.max(1, Number(question.page ?? pageNumber) || pageNumber),
        parentOptionId: parseOptionalNumber(question.parent_option_id),
        parentOptionLocalId:
          question.parent_option_id !== null &&
          question.parent_option_id !== undefined
            ? `option-${question.parent_option_id}`
            : null,
        text:
          question.question_text?.trim() || `Pertanyaan ${questionIndex + 1}`,
        type: questionType,
      });
    });
  });

  return {
    questions: removeOverDepthConditionalQuestions(questions),
    sectionTitles: Object.fromEntries(sectionTitles) as Record<number, string>,
    status: detail.status?.trim().toLowerCase() || "draft",
    surveyInfo: {
      audienceMode: isPublicAudience ? "all" : "limited",
      closesAt: toDateTimeInputValue(detail.closes_at),
      description: detail.description ?? "",
      estimatedTime:
        detail.estimated_time === null || detail.estimated_time === undefined
          ? ""
          : String(detail.estimated_time),
      instructions: detail.instructions ?? "",
      opensAt: toDateTimeInputValue(detail.opens_at),
      positions: isPublicAudience
        ? []
        : restrictions.filter((position) => position !== "public"),
      title: detail.title ?? "",
    } satisfies SurveyInfo,
    thumbnailPreviewUrl: resolveThumbnailUrl(detail.thumbnail_path),
  };
};

export const CreateSurvey = ({
  accountDescription,
  accountName,
  editSurveyId = null,
  isAuthenticated,
  mode = "create",
  onAuthAction,
  onBackHome,
  onOpenManageSurveys,
  onOpenProfile,
  onUnauthorized,
}: CreateSurveyProps) => {
  const draftStorageKey = useMemo(
    () => getDraftStorageKey(mode, editSurveyId),
    [editSurveyId, mode],
  );
  const storedDraft = useMemo(
    () => readStoredDraft(draftStorageKey),
    [draftStorageKey],
  );
  const surveyBasePath =
    mode === "edit" && editSurveyId
      ? `/surveys/edit/${editSurveyId}`
      : "/surveys/create";
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [step, setStep] = useState<BuilderStep>(() => getStepFromUrl());
  const [surveyId, setSurveyId] = useState<number | null>(
    mode === "edit" ? editSurveyId : (storedDraft.surveyId ?? null),
  );
  const [activePage, setActivePage] = useState(() =>
    getQuestionPageFromUrl(storedDraft.activePage ?? 1),
  );
  const [surveyInfo, setSurveyInfo] = useState<SurveyInfo>({
    ...defaultSurveyInfo,
    ...(storedDraft.surveyInfo ?? {}),
  });
  const [sectionTitles, setSectionTitles] = useState<Record<number, string>>({
    1: storedDraft.sectionTitle ?? "",
    ...Object.fromEntries(
      Object.entries(storedDraft.sectionTitles ?? {}).map(([page, title]) => [
        Number(page),
        title,
      ]),
    ),
  });
  const [questions, setQuestions] = useState<SurveyQuestion[]>(() =>
    removeOverDepthConditionalQuestions(storedDraft.questions ?? []),
  );
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(
    mode === "edit" && editSurveyId !== null,
  );
  const [isPublishConfirmOpen, setIsPublishConfirmOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [surveyStatus, setSurveyStatus] = useState<SurveyStatus>("draft");
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreviewUrl, setThumbnailPreviewUrl] = useState(
    defaultThumbnailPreview,
  );
  const sectionTitleInputRef = useRef<HTMLInputElement | null>(null);
  const thumbnailObjectUrl = useRef<string | null>(null);
  const isEditingSurvey = mode === "edit" && editSurveyId !== null;
  const isSurveyLocked = isEditingSurvey && surveyStatus !== "draft";

  useEffect(() => {
    localStorage.setItem(
      draftStorageKey,
      JSON.stringify({
        activePage,
        questions,
        sectionTitles,
        surveyId,
        surveyInfo,
      }),
    );
  }, [activePage, draftStorageKey, questions, sectionTitles, surveyId, surveyInfo]);

  useEffect(() => {
    if (!isEditingSurvey || editSurveyId === null) {
      return;
    }

    const controller = new AbortController();

    const loadSurveyDetail = async () => {
      setIsDetailLoading(true);
      setFeedback(null);

      try {
        const response = await fetch(`${API_BASE_URL}/surveys/${editSurveyId}`, {
          credentials: "include",
          headers: authHeaders(),
          method: "GET",
          signal: controller.signal,
        });

        if (response.status === 401) {
          onUnauthorized?.();
          return;
        }

        if (!response.ok) {
          throw new Error(
            await getApiMessage(response, "Detail survey belum bisa dimuat."),
          );
        }

        const result = (await response.json()) as ApiResult<SurveyDetail>;
        const detail = result.data;

        if (!detail) {
          throw new Error("Detail survey tidak ditemukan.");
        }

        const normalizedDetail = normalizeSurveyDetail(detail);
        setSurveyId(Number(detail.id ?? editSurveyId));
        setSurveyInfo(normalizedDetail.surveyInfo);
        setSectionTitles(normalizedDetail.sectionTitles);
        setQuestions(normalizedDetail.questions);
        setSurveyStatus(normalizedDetail.status);
        setThumbnailPreviewUrl(normalizedDetail.thumbnailPreviewUrl);

        if (normalizedDetail.status !== "draft" && getStepFromUrl() === 2) {
          setStep(1);
          syncStepUrl(surveyBasePath, 1, 1, true);
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setFeedback({
          message:
            error instanceof Error
              ? error.message
              : "Detail survey belum bisa dimuat.",
          type: "error",
        });
      } finally {
        if (!controller.signal.aborted) {
          setIsDetailLoading(false);
        }
      }
    };

    void loadSurveyDetail();

    return () => controller.abort();
  }, [editSurveyId, isEditingSurvey, onUnauthorized, surveyBasePath]);

  useEffect(() => {
    return () => {
      if (thumbnailObjectUrl.current) {
        URL.revokeObjectURL(thumbnailObjectUrl.current);
      }
    };
  }, []);

  useEffect(() => {
    syncStepUrl(surveyBasePath, step, activePage, true);

    const handlePopState = () => {
      setStep(getStepFromUrl());
      setActivePage((currentPage) => getQuestionPageFromUrl(currentPage));
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [activePage, step, surveyBasePath]);

  useEffect(() => {
    if (!feedback) {
      return;
    }

    const timerId = window.setTimeout(() => {
      setFeedback(null);
    }, 4600);

    return () => window.clearTimeout(timerId);
  }, [feedback]);

  const closeSidebar = () => setIsSidebarOpen(false);

  const toggleSidebar = () => {
    setIsSidebarOpen((current) => !current);
  };

  const handleAuthAction = () => {
    closeSidebar();
    onAuthAction?.();
  };

  const handleProfileClick = () => {
    closeSidebar();
    onOpenProfile?.();
  };

  const handleNavigationClick = (label: string) => {
    closeSidebar();

    if (label === "Dashboard") {
      onBackHome?.();
    }

    if (label === "Kelola Survey") {
      onOpenManageSurveys?.();
    }
  };

  const questionPages = useMemo(() => {
    const pages = new Set([activePage, 1]);

    questions.forEach((question) => pages.add(question.page));

    return Array.from(pages).sort((left, right) => left - right);
  }, [activePage, questions]);

  const currentPageRootQuestions = questions.filter(
    (question) =>
      question.page === activePage && !isConditionalQuestion(question),
  );
  const currentSectionTitle = sectionTitles[activePage] ?? "";

  const stepCopy: Record<BuilderStep, { description: string; subtitle: string }> = {
    1: {
      description:
        "Lengkapi detail form di bawah untuk membuat dan menerbitkan survey baru bagi masyarakat.",
      subtitle: "Langkah 1 dari 3: Informasi Umum",
    },
    2: {
      description: "Langkah 2 dari 3: Isi Kuesioner",
      subtitle: "Langkah 2 dari 3: Isi Kuesioner",
    },
    3: {
      description: "Lengkapi detail pengaturan untuk mempublikasikan survey Anda.",
      subtitle: "Langkah 3 dari 3: Pengaturan",
    },
  };

  const updateSurveyInfo = <TKey extends keyof SurveyInfo>(
    key: TKey,
    value: SurveyInfo[TKey],
  ) => {
    setSurveyInfo((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const updateSectionTitle = (value: string) => {
    setSectionTitles((current) => ({
      ...current,
      [activePage]: value,
    }));
  };

  const saveActiveSection = async () => {
    try {
      if (isSurveyLocked) {
        setFeedback({
          message: "Section tidak dapat diubah setelah survey dipublikasikan.",
          type: "info",
        });
        return;
      }

      if (!isAuthenticated) {
        onUnauthorized?.();
        throw new UnauthorizedError();
      }

      let targetSurveyId = surveyId;

      if (targetSurveyId === null) {
        if (surveyInfo.title.trim() === "") {
          setFeedback({
            message:
              "Nama section tersimpan di draft lokal. Isi judul survey agar bisa disimpan ke server.",
            type: "info",
          });
          return;
        }

        targetSurveyId = await saveSurveyDraft();
      }

      await requestJson(
        `/surveys/${targetSurveyId}/pages/${activePage}`,
        {
          body: JSON.stringify({
            section: (sectionTitles[activePage] ?? "").trim(),
          }),
          method: "PUT",
        },
        "Nama section belum bisa disimpan.",
      );
    } catch (error) {
      setFeedback({
        message: getOperationMessage(error, "Nama section belum bisa disimpan."),
        type: "error",
      });
    }
  };

  const toggleSectionTitleFocus = async () => {
    const sectionInput = sectionTitleInputRef.current;

    if (!sectionInput) {
      return;
    }

    if (document.activeElement === sectionInput) {
      sectionInput.blur();
      await saveActiveSection();
      return;
    }

    sectionInput.focus();
  };

  const setBuilderStep = (nextStep: BuilderStep, replace = false) => {
    setStep(nextStep);
    syncStepUrl(surveyBasePath, nextStep, activePage, replace);
  };

  const selectQuestionPage = (pageNumber: number) => {
    const nextPage = Math.max(1, pageNumber);
    setActivePage(nextPage);

    if (step === 2) {
      syncStepUrl(surveyBasePath, 2, nextPage);
    }
  };

  const isAudienceSelected = (position: string) => {
    if (position === "public") {
      return surveyInfo.audienceMode === "all";
    }

    return (
      surveyInfo.audienceMode === "limited" &&
      surveyInfo.positions.includes(position)
    );
  };

  const togglePosition = (position: string) => {
    if (position === "public") {
      setSurveyInfo((current) => ({
        ...current,
        audienceMode: "all",
        positions: [],
      }));
      return;
    }

    setSurveyInfo((current) => {
      const nextPositions = current.positions.includes(position)
        ? current.positions.filter((item) => item !== position)
        : [...current.positions, position];

      return {
        ...current,
        audienceMode: nextPositions.length > 0 ? "limited" : "all",
        positions: nextPositions,
      };
    });
  };

  const handleThumbnailChange = (file: File | null) => {
    if (!file) {
      return;
    }

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setFeedback({
        message: "Format thumbnail harus JPG, PNG, atau WEBP.",
        type: "error",
      });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setFeedback({
        message: "Ukuran thumbnail maksimal 2MB.",
        type: "error",
      });
      return;
    }

    if (thumbnailObjectUrl.current) {
      URL.revokeObjectURL(thumbnailObjectUrl.current);
    }

    const nextPreviewUrl = URL.createObjectURL(file);
    thumbnailObjectUrl.current = nextPreviewUrl;
    setThumbnailFile(file);
    setThumbnailPreviewUrl(nextPreviewUrl);
    setFeedback(null);
  };

  const validateSurveyInfo = (options: { requireAudience?: boolean } = {}) => {
    const nextErrors: FieldErrors = {};

    if (surveyInfo.title.trim() === "") {
      nextErrors.title = "Judul survey harus diisi.";
    }

    if (
      surveyInfo.estimatedTime.trim() !== "" &&
      toNumberOrNull(surveyInfo.estimatedTime) === null
    ) {
      nextErrors.estimatedTime = "Estimasi waktu harus lebih dari 0.";
    }

    const hasSelectedAudience =
      surveyInfo.audienceMode === "all" || surveyInfo.positions.length > 0;

    if (options.requireAudience && !hasSelectedAudience) {
      nextErrors.positions = "Target responden harus diisi.";
    } else if (
      surveyInfo.audienceMode === "limited" &&
      surveyInfo.positions.length === 0
    ) {
      nextErrors.positions = "Pilih minimal satu target responden.";
    }

    if (
      surveyInfo.opensAt &&
      surveyInfo.closesAt &&
      new Date(surveyInfo.opensAt).getTime() >=
        new Date(surveyInfo.closesAt).getTime()
    ) {
      nextErrors.closesAt = "Tanggal selesai harus setelah tanggal mulai.";
    }

    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const getOperationMessage = (error: unknown, fallbackMessage: string) => {
    if (error instanceof UnauthorizedError) {
      onUnauthorized?.();
      return error.message;
    }

    return error instanceof Error ? error.message : fallbackMessage;
  };

  const uploadThumbnail = async (targetSurveyId: number) => {
    if (!thumbnailFile) {
      return null;
    }

    const formData = new FormData();
    formData.append("thumbnail", thumbnailFile);

    const result = await requestFormData<UploadResult>(
      `/surveys/${targetSurveyId}/thumbnail`,
      formData,
      "Thumbnail belum bisa diupload.",
    );

    setThumbnailFile(null);
    return result.data?.thumbnail_path ?? null;
  };

  const saveSurveyDraft = async () => {
    if (!isAuthenticated) {
      onUnauthorized?.();
      throw new UnauthorizedError();
    }

    if (!validateSurveyInfo()) {
      throw new Error("Lengkapi informasi survey terlebih dahulu.");
    }

    const payload: Partial<ReturnType<typeof buildSurveyPayload>> =
      buildSurveyPayload(surveyInfo, isEditingSurvey ? surveyStatus : "draft");

    if (isSurveyLocked) {
      delete payload.status;
    }

    setIsSaving(true);

    try {
      if (surveyId === null) {
        const result = await requestJson<IdResult>(
          "/surveys",
          {
            body: JSON.stringify(payload),
            method: "POST",
          },
          "Draft survey belum bisa dibuat.",
        );
        const nextSurveyId = Number(result.data?.id);

        if (!Number.isFinite(nextSurveyId)) {
          throw new Error("ID draft survey tidak valid dari server.");
        }

        setSurveyId(nextSurveyId);
        await uploadThumbnail(nextSurveyId);
        return nextSurveyId;
      }

      await requestJson(
        `/surveys/${surveyId}`,
        {
          body: JSON.stringify(payload),
          method: "PUT",
        },
        "Draft survey belum bisa disimpan.",
      );
      await uploadThumbnail(surveyId);

      return surveyId;
    } finally {
      setIsSaving(false);
    }
  };

  const saveSections = async (targetSurveyId: number) => {
    for (const pageNumber of questionPages) {
      const section = (sectionTitles[pageNumber] ?? "").trim();

      await requestJson(
        `/surveys/${targetSurveyId}/pages/${pageNumber}`,
        {
          body: JSON.stringify({ section }),
          method: "PUT",
        },
        "Section belum bisa disimpan.",
      );
    }
  };

  const goToStep = async (nextStep: BuilderStep) => {
    if (isSurveyLocked && nextStep === 2) {
      setFeedback({
        message:
          "Isi survey tidak dapat diubah setelah dipublikasikan. Anda masih bisa mengubah Informasi Umum dan Pengaturan survey.",
        type: "info",
      });
      return;
    }

    try {
      const targetSurveyId = await saveSurveyDraft();

      if (!isSurveyLocked && (nextStep > 1 || step > 1)) {
        await saveSections(targetSurveyId);
      }

      if (nextStep === 3 && questions.length === 0) {
        setFieldErrors({ questions: "Tambahkan minimal satu pertanyaan." });
        throw new Error("Tambahkan minimal satu pertanyaan sebelum publikasi.");
      }

      if (!isSurveyLocked && nextStep === 3) {
        await persistAllQuestions(targetSurveyId);
      }

      setFeedback({
        message: "Draft tersimpan otomatis.",
        type: "success",
      });
      setBuilderStep(nextStep);
    } catch (error) {
      setFeedback({
        message: getOperationMessage(
          error,
          "Draft survey belum bisa disimpan.",
        ),
        type: "error",
      });
    }
  };

  const addQuestion = () => {
    const question = {
      ...createQuestion(),
      page: activePage,
    };
    setQuestions((current) => [...current, question]);
    setFieldErrors((current) => {
      const nextErrors = { ...current };
      delete nextErrors.questions;
      return nextErrors;
    });
  };

  const addQuestionPage = () => {
    const nextPage = Math.max(...questionPages) + 1;
    selectQuestionPage(nextPage);
  };

  const updateQuestion = (
    localId: string,
    updater: (question: SurveyQuestion) => SurveyQuestion,
  ) => {
    setQuestions((current) =>
      current.map((question) =>
        question.localId === localId ? updater(question) : question,
      ),
    );
  };

  const changeQuestionType = async (localId: string, type: QuestionType) => {
    const targetQuestion = questions.find(
      (question) => question.localId === localId,
    );
    const removedConditionalQuestions =
      targetQuestion && type !== "radio_button"
        ? targetQuestion.options.flatMap((option) =>
            questions.filter((question) =>
              isQuestionLinkedToOption(question, option),
            ),
          )
        : [];

    setQuestions((current) => {
      const targetQuestion = current.find(
        (question) => question.localId === localId,
      );

      const nextQuestions = current.map((question) =>
        question.localId === localId
          ? {
              ...question,
              options: isChoiceQuestion(type)
                ? question.options.length === 0
                  ? [createOption("Opsi 1"), createOption("Opsi 2")]
                  : question.options
                : [],
              type,
            }
          : question,
      );

      if (!targetQuestion || type === "radio_button") {
        return nextQuestions;
      }

      return targetQuestion.options.reduce(
        (questionsWithoutChildren, option) =>
          removeQuestionsLinkedToOptionWithDescendants(
            questionsWithoutChildren,
            option,
          ),
        nextQuestions,
      );
    });

    if (surveyId === null || removedConditionalQuestions.length === 0) {
      return;
    }

    try {
      for (const conditionalQuestion of removedConditionalQuestions) {
        if (!conditionalQuestion.id) {
          continue;
        }

        await requestJson(
          `/surveys/${surveyId}/questions/${conditionalQuestion.id}`,
          { method: "DELETE" },
          "Pertanyaan kondisional belum bisa dihapus.",
        );
      }
    } catch (error) {
      setFeedback({
        message: getOperationMessage(
          error,
          "Pertanyaan kondisional belum bisa dihapus.",
        ),
        type: "error",
      });
    }
  };

  const addOption = (questionLocalId: string) => {
    updateQuestion(questionLocalId, (question) => ({
      ...question,
      options: [
        ...question.options,
        createOption(`Opsi ${question.options.length + 1}`),
      ],
    }));
  };

  const addConditionalQuestion = (parentOption: QuestionOption) => {
    const optionOwnerQuestion = getOptionOwnerQuestion(questions, parentOption);
    const optionOwnerDepth = optionOwnerQuestion
      ? getQuestionDepth(questions, optionOwnerQuestion)
      : 1;

    if (optionOwnerDepth >= MAX_QUESTION_DEPTH) {
      setFeedback({
        message: "Pertanyaan kondisional dibatasi maksimal 3 tingkat.",
        type: "info",
      });
      return;
    }

    setQuestions((current) => [
      ...current,
      createConditionalQuestion(parentOption, activePage),
    ]);
  };

  const removeOption = async (
    questionLocalId: string,
    option: QuestionOption,
  ) => {
    const question = questions.find((item) => item.localId === questionLocalId);

    if (surveyId !== null && question?.id && option.id) {
      await requestJson(
        `/surveys/${surveyId}/questions/${question.id}/options/${option.id}`,
        { method: "DELETE" },
        "Opsi belum bisa dihapus.",
      );
    }

    updateQuestion(questionLocalId, (current) => ({
      ...current,
      options: current.options.filter((item) => item.localId !== option.localId),
    }));

    setQuestions((current) =>
      removeQuestionsLinkedToOptionWithDescendants(current, option),
    );
  };

  const deleteQuestion = async (question: SurveyQuestion) => {
    try {
      if (surveyId !== null && question.id) {
        await requestJson(
          `/surveys/${surveyId}/questions/${question.id}`,
          { method: "DELETE" },
          "Pertanyaan belum bisa dihapus.",
        );
      }

      setQuestions((current) =>
        removeQuestionsWithDescendants(current, question),
      );
    } catch (error) {
      setFeedback({
        message: getOperationMessage(
          error,
          "Pertanyaan belum bisa dihapus.",
        ),
        type: "error",
      });
    }
  };

  const persistQuestion = async (
    targetSurveyId: number,
    question: SurveyQuestion,
    optionIdsByLocalId: OptionIdsByLocalId,
  ): Promise<SurveyQuestion> => {
    const questionText = question.text.trim();

    if (questionText === "") {
      throw new Error("Teks pertanyaan harus diisi.");
    }

    const cleanOptions = question.options
      .map((option) => ({ ...option, text: option.text.trim() }))
      .filter((option) => option.text !== "");

    if (isChoiceQuestion(question.type) && cleanOptions.length < 2) {
      throw new Error("Pertanyaan pilihan butuh minimal dua opsi.");
    }

    const parentOptionId = question.parentOptionLocalId
      ? (optionIdsByLocalId.get(question.parentOptionLocalId) ??
        question.parentOptionId ??
        null)
      : (question.parentOptionId ?? null);

    if (question.parentOptionLocalId && !parentOptionId) {
      throw new Error(
        "Opsi induk untuk pertanyaan kondisional belum tersimpan.",
      );
    }

    const questionPayload = {
      is_required: question.isRequired,
      page: question.page,
      parent_option_id: parentOptionId,
      question_text: questionText,
      question_type: question.type,
    };

    let nextQuestionId = question.id;

    if (nextQuestionId) {
      await requestJson(
        `/surveys/${targetSurveyId}/questions/${nextQuestionId}`,
        {
          body: JSON.stringify(questionPayload),
          method: "PUT",
        },
        "Pertanyaan belum bisa disimpan.",
      );
    } else {
      const result = await requestJson<IdResult>(
        `/surveys/${targetSurveyId}/questions`,
        {
          body: JSON.stringify(questionPayload),
          method: "POST",
        },
        "Pertanyaan belum bisa dibuat.",
      );
      nextQuestionId = Number(result.data?.id);
    }

    if (!Number.isFinite(nextQuestionId)) {
      throw new Error("ID pertanyaan tidak valid dari server.");
    }

    if (!isChoiceQuestion(question.type)) {
      for (const option of question.options) {
        if (option.id) {
          await requestJson(
            `/surveys/${targetSurveyId}/questions/${nextQuestionId}/options/${option.id}`,
            { method: "DELETE" },
            "Opsi lama belum bisa dihapus.",
          );
        }
      }

      return {
        ...question,
        id: nextQuestionId,
        options: [],
        parentOptionId,
        text: questionText,
      };
    }

    const savedOptions: QuestionOption[] = [];

    for (const [index, option] of cleanOptions.entries()) {
      if (option.id) {
        await requestJson(
          `/surveys/${targetSurveyId}/questions/${nextQuestionId}/options/${option.id}`,
          {
            body: JSON.stringify({
              option_order: index + 1,
              option_text: option.text,
            }),
            method: "PUT",
          },
          "Opsi belum bisa disimpan.",
        );
        savedOptions.push(option);
        continue;
      }

      const result = await requestJson<IdResult>(
        `/surveys/${targetSurveyId}/questions/${nextQuestionId}/options`,
        {
          body: JSON.stringify({ option_text: option.text }),
          method: "POST",
        },
        "Opsi belum bisa dibuat.",
      );
      savedOptions.push({
        ...option,
        id: Number(result.data?.id),
      });
    }

    return {
      ...question,
      id: nextQuestionId,
      options: savedOptions,
      parentOptionId,
      text: questionText,
    };
  };

  const persistAllQuestions = async (targetSurveyId: number) => {
    const savedQuestions: SurveyQuestion[] = [];
    const optionIdsByLocalId: OptionIdsByLocalId = new Map();

    for (const question of orderQuestionsForPersistence(questions)) {
      const savedQuestion = await persistQuestion(
        targetSurveyId,
        question,
        optionIdsByLocalId,
      );

      savedQuestion.options.forEach((option) => {
        if (option.id) {
          optionIdsByLocalId.set(option.localId, option.id);
        }
      });

      savedQuestions.push(savedQuestion);
    }

    setQuestions(savedQuestions);
  };

  const persistDraftQuestions = async (targetSurveyId: number) => {
    const draftQuestions = questions.filter((question) => question.text.trim());

    if (draftQuestions.length === 0) {
      return;
    }

    const savedQuestions: SurveyQuestion[] = [];
    const optionIdsByLocalId: OptionIdsByLocalId = new Map();

    questions.forEach((question) => {
      question.options.forEach((option) => {
        if (option.id) {
          optionIdsByLocalId.set(option.localId, option.id);
        }
      });
    });

    for (const question of orderQuestionsForPersistence(draftQuestions)) {
      const savedQuestion = await persistQuestion(
        targetSurveyId,
        question,
        optionIdsByLocalId,
      );

      savedQuestion.options.forEach((option) => {
        if (option.id) {
          optionIdsByLocalId.set(option.localId, option.id);
        }
      });

      savedQuestions.push(savedQuestion);
    }

    setQuestions((current) =>
      current.map(
        (question) =>
          savedQuestions.find((saved) => saved.localId === question.localId) ??
          question,
      ),
    );
  };

  const saveDraftOnly = async () => {
    try {
      const targetSurveyId = await saveSurveyDraft();

      if (!isSurveyLocked && step > 1) {
        await saveSections(targetSurveyId);
      }

      if (!isSurveyLocked && questions.length > 0) {
        await persistDraftQuestions(targetSurveyId);
      }

      setFeedback({
        message: "Draft survey berhasil disimpan.",
        type: "success",
      });
    } catch (error) {
      setFeedback({
        message: getOperationMessage(
          error,
          "Draft survey belum bisa disimpan.",
        ),
        type: "error",
      });
    }
  };

  const leaveBuilder = async () => {
    if (surveyInfo.title.trim() === "") {
      onOpenManageSurveys?.();
      return;
    }

    try {
      const targetSurveyId = await saveSurveyDraft();

      if (!isSurveyLocked && step > 1) {
        await saveSections(targetSurveyId);
      }

      if (!isSurveyLocked && questions.length > 0) {
        await persistAllQuestions(targetSurveyId);
      }
    } catch (error) {
      setFeedback({
        message: getOperationMessage(
          error,
          "Draft survey belum bisa disimpan.",
        ),
        type: "error",
      });
      return;
    }

    onOpenManageSurveys?.();
  };

  const requestPublishSurvey = () => {
    if (!validateSurveyInfo({ requireAudience: true })) {
      setFeedback({
        message: "Lengkapi pengaturan survey sebelum publikasi.",
        type: "error",
      });
      return;
    }

    if (questions.length === 0) {
      setFieldErrors({ questions: "Tambahkan minimal satu pertanyaan." });
      setFeedback({
        message: "Tambahkan minimal satu pertanyaan sebelum publikasi.",
        type: "error",
      });
      return;
    }

    setIsPublishConfirmOpen(true);
  };

  const publishSurvey = async () => {
    if (!validateSurveyInfo({ requireAudience: true })) {
      setFeedback({
        message: "Lengkapi pengaturan survey sebelum publikasi.",
        type: "error",
      });
      return;
    }

    if (questions.length === 0) {
      setFieldErrors({ questions: "Tambahkan minimal satu pertanyaan." });
      setFeedback({
        message: "Tambahkan minimal satu pertanyaan sebelum publikasi.",
        type: "error",
      });
      return;
    }

    setIsPublishConfirmOpen(false);
    setIsSaving(true);

    try {
      const targetSurveyId = await saveSurveyDraft();
      await saveSections(targetSurveyId);
      await persistAllQuestions(targetSurveyId);

      await requestJson(
        `/surveys/${targetSurveyId}`,
        {
          body: JSON.stringify({
            ...buildSurveyPayload(
              surveyInfo,
              getPublishStatus(surveyInfo.opensAt),
            ),
          }),
          method: "PUT",
        },
        "Survey belum bisa dipublikasikan.",
      );

      localStorage.removeItem(draftStorageKey);
      setFeedback({
        message: "Survey berhasil dipublikasikan.",
        type: "success",
      });
      onOpenManageSurveys?.();
    } catch (error) {
      setFeedback({
        message: getOperationMessage(
          error,
          "Survey belum bisa dipublikasikan.",
        ),
        type: "error",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const renderStepOne = () => (
    <section
      className="create-survey-card create-survey-card--info"
      aria-labelledby="survey-info-title"
    >
      <div className="create-survey-card__header">
        <span aria-hidden="true">
          <img src={infoIcon} alt="" />
        </span>
        <div>
          <h2 id="survey-info-title">1. Informasi Umum</h2>
        </div>
      </div>

      <div className="create-survey-form-grid">
        <label className="create-survey-field create-survey-field--wide">
          <span>Judul Survey</span>
          <input
            onChange={(event) => updateSurveyInfo("title", event.target.value)}
            placeholder="Contoh: Survey Kepuasan Layanan Kesehatan"
            value={surveyInfo.title}
          />
          {fieldErrors.title && <small>{fieldErrors.title}</small>}
        </label>

        <label className="create-survey-field create-survey-field--wide">
          <span>Deskripsi / Tujuan Survey</span>
          <textarea
            onChange={(event) =>
              updateSurveyInfo("description", event.target.value)
            }
            placeholder="Jelaskan secara singkat mengenai tujuan dari pelaksanaan survey ini..."
            rows={4}
            value={surveyInfo.description}
          />
        </label>

        <label className="create-survey-field create-survey-field--wide">
          <span>Petunjuk Pengisian</span>
          <textarea
            onChange={(event) =>
              updateSurveyInfo("instructions", event.target.value)
            }
            placeholder="Tuliskan petunjuk teknis pengisian survey untuk responden..."
            rows={3}
            value={surveyInfo.instructions}
          />
        </label>

        <div className="create-thumbnail-field">
          <span>Unggah Thumbnail</span>
          <div className="create-thumbnail-field__body">
            <figure className="create-thumbnail-preview">
              <img alt="" src={thumbnailPreviewUrl} />
              <figcaption>
                {thumbnailFile ? thumbnailFile.name : "Gambar Default"}
              </figcaption>
            </figure>
            <label className="create-thumbnail-upload">
              <input
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) =>
                  handleThumbnailChange(event.target.files?.[0] ?? null)
                }
                type="file"
              />
              <span aria-hidden="true">
                <img src={uploadIcon} alt="" />
              </span>
              <strong>Pilih File</strong>
              <small>atau seret gambar ke sini</small>
            </label>
          </div>
          <em>
            Format: JPG, PNG, WEBP (Maks. 2MB). Rekomendasi 1200x630 px.
          </em>
        </div>
      </div>
    </section>
  );

  const resetSurveySchedule = () => {
    setSurveyInfo((current) => ({
      ...current,
      closesAt: "",
      opensAt: "",
    }));
    setFieldErrors((current) => {
      const nextErrors = { ...current };
      delete nextErrors.closesAt;
      delete nextErrors.opensAt;
      return nextErrors;
    });
  };

  const resetEstimatedTime = () => {
    setSurveyInfo((current) => ({
      ...current,
      estimatedTime: "",
    }));
    setFieldErrors((current) => {
      const nextErrors = { ...current };
      delete nextErrors.estimatedTime;
      return nextErrors;
    });
  };

  const renderStepSettings = () => (
    <section
      className="create-settings-grid"
      aria-label="Pengaturan publikasi survey"
    >
      <div className="create-settings-card">
        <header>
          <span>
            <img src={calendarIcon} alt="" aria-hidden="true" />
            <h2>Jadwal Survey</h2>
          </span>
          <button onClick={resetSurveySchedule} type="button">
            Reset
          </button>
        </header>
        <div className="create-settings-card__grid">
          <label className="create-survey-field">
            <span>Tanggal Mulai</span>
            <input
              onChange={(event) =>
                updateSurveyInfo("opensAt", event.target.value)
              }
              type="datetime-local"
              value={surveyInfo.opensAt}
            />
          </label>
          <label className="create-survey-field">
            <span>Tanggal Selesai</span>
            <input
              onChange={(event) =>
                updateSurveyInfo("closesAt", event.target.value)
              }
              type="datetime-local"
              value={surveyInfo.closesAt}
            />
            {fieldErrors.closesAt && <small>{fieldErrors.closesAt}</small>}
          </label>
          <label className="create-survey-field create-survey-field--wide">
            <span className="create-survey-field__label-row">
              Estimasi Waktu
              <button onClick={resetEstimatedTime} type="button">
                Reset
              </button>
            </span>
            <input
              aria-label="Estimasi waktu dalam menit"
              min="1"
              onChange={(event) =>
                updateSurveyInfo("estimatedTime", event.target.value)
              }
              placeholder="Menit"
              type="number"
              value={surveyInfo.estimatedTime}
            />
            {fieldErrors.estimatedTime && (
              <small>{fieldErrors.estimatedTime}</small>
            )}
          </label>
        </div>
      </div>

      <div className="create-settings-card">
        <header>
          <span>
            <img src={targetIcon} alt="" aria-hidden="true" />
            <h2>Target Responden</h2>
          </span>
        </header>
        <div className="create-survey-audience">
          <span>Pilih Audiens</span>
          <div className="create-survey-audience__checks">
            {positionOptions.map((option) => (
              <label key={option.value}>
                <input
                  checked={isAudienceSelected(option.value)}
                  onChange={() => togglePosition(option.value)}
                  type="checkbox"
                />
                <span>
                  <strong>{option.label}</strong>
                  <small>{option.description}</small>
                </span>
              </label>
            ))}
          </div>
          {fieldErrors.positions && <small>{fieldErrors.positions}</small>}
        </div>
      </div>
    </section>
  );

  const getConditionalQuestions = (option: QuestionOption) =>
    questions.filter(
      (question) =>
        question.page === activePage &&
        isQuestionLinkedToOption(question, option),
    );

  const renderQuestionCard = (
    question: SurveyQuestion,
    index: number,
    isNested = false,
  ) => {
    const questionLabel = isNested
      ? "Teks Pertanyaan Turunan"
      : `Teks Pertanyaan ${index + 1}`;
    const questionDepth = getQuestionDepth(questions, question);
    const canAddConditionalQuestion =
      question.type === "radio_button" && questionDepth < MAX_QUESTION_DEPTH;
    const questionControls = (
      <aside className="create-question-side">
        <label className="create-survey-field">
          <span>Tipe Pertanyaan</span>
          <select
            onChange={(event) =>
              void changeQuestionType(
                question.localId,
                event.target.value as QuestionType,
              )
            }
            value={question.type}
          >
            {questionTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </label>

        <label className="create-survey-switch">
          <input
            checked={question.isRequired}
            onChange={(event) =>
              updateQuestion(question.localId, (current) => ({
                ...current,
                isRequired: event.target.checked,
              }))
            }
            type="checkbox"
          />
          Wajib Diisi
        </label>
      </aside>
    );
    const questionBody = (
      <div className="create-question-main">
        <label className="create-survey-field">
          <span>{questionLabel}</span>
          <textarea
            onChange={(event) =>
              updateQuestion(question.localId, (current) => ({
                ...current,
                text: event.target.value,
              }))
            }
            placeholder="Tulis pertanyaan untuk responden"
            rows={3}
            value={question.text}
          />
        </label>

        {isChoiceQuestion(question.type) ? (
          <div className="create-question-options">
            <span>Pilihan Jawaban</span>
            {question.options.map((option, optionIndex) => {
              const conditionalQuestions = getConditionalQuestions(option);
              const optionLabel = option.text || `Pilihan ${optionIndex + 1}`;

              return (
                <div className="create-question-option" key={option.localId}>
                  <div className="create-question-option__input">
                    <i
                      aria-hidden="true"
                      className={`create-option-marker create-option-marker--${question.type}`}
                    />
                    <input
                      onChange={(event) =>
                        updateQuestion(question.localId, (current) => ({
                          ...current,
                          options: current.options.map((item) =>
                            item.localId === option.localId
                              ? { ...item, text: event.target.value }
                              : item,
                          ),
                        }))
                      }
                      placeholder={`Pilihan ${optionIndex + 1}`}
                      value={option.text}
                    />
                    <button
                      aria-label={`Hapus opsi ${optionIndex + 1}`}
                      className="create-question-option__delete"
                      disabled={question.options.length <= 2}
                      onClick={() => void removeOption(question.localId, option)}
                      type="button"
                    >
                      <img src={deleteIcon} alt="" aria-hidden="true" />
                    </button>
                  </div>

                  {canAddConditionalQuestion && (
                    <div className="create-question-conditional">
                      {conditionalQuestions.map((conditionalQuestion) => (
                        <div
                          className="create-question-conditional__item"
                          key={conditionalQuestion.localId}
                        >
                          <span>
                            {`Jika "${optionLabel}" dipilih, tampilkan`}
                          </span>
                          {renderQuestionCard(
                            conditionalQuestion,
                            questions.indexOf(conditionalQuestion),
                            true,
                          )}
                        </div>
                      ))}
                      <button
                        className="create-question-conditional__add"
                        onClick={() => addConditionalQuestion(option)}
                        type="button"
                      >
                        Tambah Kondisional
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
            <button onClick={() => addOption(question.localId)} type="button">
              <img src={addOptionIcon} alt="" aria-hidden="true" />
              Tambah Opsi
            </button>
          </div>
        ) : (
          <div className="create-question-preview">
            Responden akan menulis jawaban di sini.
          </div>
        )}
      </div>
    );

    return (
      <article
        className={[
          "create-question-card",
          isNested ? "create-question-card--nested" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        key={question.localId}
      >
        <header aria-label={questionLabel}>
          <button
            aria-label={`Hapus ${questionLabel.toLowerCase()}`}
            onClick={() => void deleteQuestion(question)}
            type="button"
          >
            <img src={deleteIcon} alt="" aria-hidden="true" />
          </button>
        </header>

        <div
          className={[
            "create-question-grid",
            isNested ? "create-question-grid--nested" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {isNested ? (
            <>
              {questionControls}
              {questionBody}
            </>
          ) : (
            <>
              {questionBody}
              {questionControls}
            </>
          )}
        </div>
      </article>
    );
  };

  const renderStepTwo = () => {
    const sectionPlaceholder = `Pertanyaan Kuesioner (Halaman ${activePage})`;
    const sectionTitleSize = Math.min(
      Math.max((currentSectionTitle || sectionPlaceholder).length + 1, 24),
      64,
    );

    return (
      <section
        className="create-question-canvas"
        aria-labelledby="survey-question-title"
      >
      <div
        className="create-question-tabs"
        role="tablist"
        aria-label="Halaman survey"
      >
        {questionPages.map((pageNumber) => (
          <button
            aria-selected={activePage === pageNumber}
            className={activePage === pageNumber ? "is-active" : ""}
            key={pageNumber}
            onClick={() => selectQuestionPage(pageNumber)}
            role="tab"
            type="button"
          >
            Halaman {pageNumber}
          </button>
        ))}
        <button
          aria-label="Tambah halaman survey"
          className="create-question-tabs__add"
          onClick={addQuestionPage}
          type="button"
        >
          <img src={pagePlusIcon} alt="" aria-hidden="true" />
        </button>
      </div>

      <div className="create-question-title-row">
        <label
          className="create-section-title"
          htmlFor="survey-section-title"
          id="survey-question-title"
        >
          <input
            id="survey-section-title"
            onKeyDown={(event) => {
              if (event.key !== "Enter") {
                return;
              }

              event.preventDefault();
              void toggleSectionTitleFocus();
            }}
            onChange={(event) => updateSectionTitle(event.target.value)}
            placeholder={sectionPlaceholder}
            ref={sectionTitleInputRef}
            size={sectionTitleSize}
            value={currentSectionTitle}
          />
        </label>
        <button
          aria-label="Ubah atau simpan nama section"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => void toggleSectionTitleFocus()}
          type="button"
        >
          <img src={editIcon} alt="" aria-hidden="true" />
        </button>
      </div>

      {currentPageRootQuestions.length === 0 ? (
        <div className="create-question-empty">
          <span aria-hidden="true">
            <img src={emptyQuestionIcon} alt="" />
          </span>
          <strong>Belum ada pertanyaan</strong>
          <p>
            Tambahkan pertanyaan baru ke dalam bagian ini untuk mengelompokkan
            kuesioner Anda.
          </p>
          <button onClick={addQuestion} type="button">
            <img src={plusIcon} alt="" aria-hidden="true" />
            Tambah Pertanyaan
          </button>
        </div>
      ) : (
        <div className="create-question-list">
          {currentPageRootQuestions.map((question, index) =>
            renderQuestionCard(question, index),
          )}
          <button
            className="create-question-add"
            onClick={addQuestion}
            type="button"
          >
            <img src={plusIcon} alt="" aria-hidden="true" />
            Tambah Pertanyaan
          </button>
        </div>
      )}

      {fieldErrors.questions && (
        <span className="create-survey-sr-only">{fieldErrors.questions}</span>
      )}
      </section>
    );
  };

  const pageTitle = isEditingSurvey ? "Edit Survey" : "Buat Survey Baru";
  const surveyBadge = isEditingSurvey
    ? `${surveyStatus === "draft" ? "Draft" : "Published"} #${surveyId ?? editSurveyId}`
    : surveyId
      ? `Draft #${surveyId}`
      : "Draft baru";

  const renderBreadcrumbs = () => {
    if (step === 1) {
      return (
        <button
          className="create-survey-back-link"
          onClick={() => void leaveBuilder()}
          type="button"
        >
          <img src={arrowLeftIcon} alt="" aria-hidden="true" />
          Kembali ke Daftar Survey
        </button>
      );
    }

    return (
      <div className="create-survey-breadcrumbs" aria-label="Breadcrumb">
        <span>Beranda</span>
        <span aria-hidden="true">{">"}</span>
        <span>Kelola Survey</span>
        <span aria-hidden="true">{">"}</span>
        <strong>{pageTitle}</strong>
      </div>
    );
  };

  const renderStepIndicator = () => (
    <nav className="create-survey-steps" aria-label="Tahap buat survey">
      {([1, 2, 3] as BuilderStep[]).map((stepNumber, index) => {
        const isComplete = stepNumber < step;
        const isActive = stepNumber === step;
        const isDisabled = isSurveyLocked && stepNumber === 2;

        return (
          <button
            className={[
              isActive ? "is-active" : "",
              isComplete ? "is-complete" : "",
              isDisabled ? "is-disabled" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            aria-disabled={isDisabled}
            key={stepNumber}
            onClick={() => void goToStep(stepNumber)}
            type="button"
          >
            <span aria-hidden="true">
              {isComplete ? <img src={stepCheckIcon} alt="" /> : stepNumber}
            </span>
            {stepNumber === 1
              ? "Informasi Umum"
              : stepNumber === 2
                ? "Isi Survey"
                : "Pengaturan"}
            {index < 2 && <i aria-hidden="true" />}
          </button>
        );
      })}
    </nav>
  );

  const renderPublishDialog = () => {
    if (!isPublishConfirmOpen) {
      return null;
    }

    return (
      <div className="create-survey-dialog" role="presentation">
        <button
          aria-label="Batalkan publikasi survey"
          className="create-survey-dialog__backdrop"
          onClick={() => setIsPublishConfirmOpen(false)}
          type="button"
        />
        <section
          aria-labelledby="publish-survey-title"
          aria-modal="true"
          className="create-survey-dialog__panel"
          role="dialog"
        >
          <h2 id="publish-survey-title">
            Apakah anda yakin ingin mempublikasikan survey ini?
          </h2>
          <p>
            Form/isi survey tidak dapat diubah setelah dipublikasikan, namun
            Anda masih bisa mengubah bagian Informasi Umum dan Pengaturan
            survey.
          </p>
          <div className="create-survey-dialog__actions">
            <button
              disabled={isSaving}
              onClick={() => setIsPublishConfirmOpen(false)}
              type="button"
            >
              Batal
            </button>
            <button
              disabled={isSaving}
              onClick={() => void publishSurvey()}
              type="button"
            >
              {isSaving ? "Mempublikasikan..." : "Publikasikan"}
            </button>
          </div>
        </section>
      </div>
    );
  };

  return (
    <main className="create-survey-page">
      <Topbar
        avatarSrc={adminAvatar}
        isSidebarOpen={isSidebarOpen}
        onProfileClick={handleProfileClick}
        onToggleSidebar={toggleSidebar}
        sidebarId="create-survey-sidebar"
        title="Survey Pemkot Jogja"
      />

      <Sidebar
        accountDescription={accountDescription}
        accountName={accountName}
        activeItem="Kelola Survey"
        avatarSrc={adminAvatar}
        id="create-survey-sidebar"
        isAuthenticated={isAuthenticated}
        isOpen={isSidebarOpen}
        onAuthAction={handleAuthAction}
        onClose={closeSidebar}
        onNavigate={handleNavigationClick}
      />

      <section className="create-survey-shell">
        <div className="create-survey-content" aria-busy={isDetailLoading}>
          <header className="create-survey-heading">
            <div>
              {renderBreadcrumbs()}
              <h1>{pageTitle}</h1>
              <p>
                {step === 1
                  ? stepCopy[step].description
                  : stepCopy[step].subtitle}
              </p>
            </div>
            <span>{surveyBadge}</span>
          </header>

          {renderStepIndicator()}

          {feedback && (
            <div
              className={`create-survey-toast create-survey-toast--${feedback.type}`}
              role={feedback.type === "error" ? "alert" : "status"}
            >
              <strong>
                {feedback.type === "error"
                  ? "Gagal"
                  : feedback.type === "success"
                    ? "Berhasil"
                    : "Info"}
              </strong>
              <span>{feedback.message}</span>
              <button
                aria-label="Tutup pesan"
                onClick={() => setFeedback(null)}
                type="button"
              >
                x
              </button>
            </div>
          )}

          {step === 1 && renderStepOne()}
          {step === 2 && renderStepTwo()}
          {step === 3 && renderStepSettings()}

          <footer className="create-survey-footer">
            <button
              disabled={isSaving}
              onClick={() =>
                step < 3
                  ? void leaveBuilder()
                  : void goToStep(
                      isSurveyLocked ? 1 : ((step - 1) as BuilderStep),
                    )
              }
              type="button"
            >
              {step === 3 && (
                <img src={arrowLeftIcon} alt="" aria-hidden="true" />
              )}
              {step === 3 ? "Kembali" : "Batal"}
            </button>
            <div>
              {!(isSurveyLocked && step === 3) && (
                <button
                  disabled={isSaving}
                  onClick={() => void saveDraftOnly()}
                  type="button"
                >
                  {isEditingSurvey ? "Simpan Perubahan" : "Simpan Draft"}
                </button>
              )}
              {step < 3 ? (
                <button
                  disabled={isSaving}
                  onClick={() =>
                    void goToStep(
                      isSurveyLocked && step === 1
                        ? 3
                        : ((step + 1) as BuilderStep),
                    )
                  }
                  type="button"
                >
                  {isSaving ? (
                    "Menyimpan..."
                  ) : (
                    <>
                      Selanjutnya
                      <img src={arrowRightIcon} alt="" aria-hidden="true" />
                    </>
                  )}
                </button>
              ) : isSurveyLocked ? (
                <button
                  disabled={isSaving}
                  onClick={() => void saveDraftOnly()}
                  type="button"
                >
                  {isSaving ? "Menyimpan..." : "Simpan Perubahan"}
                </button>
              ) : (
                <button
                  disabled={isSaving}
                  onClick={requestPublishSurvey}
                  type="button"
                >
                  {isSaving ? (
                    "Mempublikasikan..."
                  ) : (
                    <>
                      Publikasikan Survey
                      <img src={publishIcon} alt="" aria-hidden="true" />
                    </>
                  )}
                </button>
              )}
            </div>
          </footer>
        </div>
      </section>
      {renderPublishDialog()}
    </main>
  );
};
