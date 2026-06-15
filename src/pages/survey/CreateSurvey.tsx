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
import plusIcon from "../../assets/survey/create/create-plus.svg";
import publishIcon from "../../assets/survey/create/create-publish.svg";
import stepCheckIcon from "../../assets/survey/create/create-step-check.svg";
import targetIcon from "../../assets/survey/create/create-target.svg";
import uploadIcon from "../../assets/survey/create/create-upload.svg";
import defaultThumbnailPreview from "../../assets/survey/create-thumbnail-preview.png";
import "../../styles/survey/CreateSurvey.scss";

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || "http://survey-general-api.test"
).replace(/\/$/, "");

const AUTH_TOKEN_KEY = "survey_auth_token";
const DRAFT_STORAGE_KEY = "survey_create_draft";

type CreateSurveyProps = {
  accountDescription?: string;
  accountName?: string;
  isAuthenticated: boolean;
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
  | "file_upload"
  | "free_text"
  | "radio_button"
  | "rating_scale";

type Feedback = {
  message: string;
  type: FeedbackType;
};

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
  text: string;
  type: QuestionType;
};

type DraftStorage = {
  activePage?: number;
  questions?: SurveyQuestion[];
  sectionTitle?: string;
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

class UnauthorizedError extends Error {
  constructor() {
    super("Sesi login berakhir. Silakan login kembali.");
  }
}

const questionTypes: Array<{ label: string; value: QuestionType }> = [
  { label: "Jawaban Singkat", value: "free_text" },
  { label: "Pilihan Tunggal", value: "radio_button" },
  { label: "Pilihan Ganda", value: "checkbox" },
  { label: "Dropdown", value: "dropdown" },
  { label: "Skala Rating", value: "rating_scale" },
  { label: "Upload File", value: "file_upload" },
];

const positionOptions = [
  { label: "Masyarakat", value: "public" },
  { label: "Pegawai ASN", value: "asn" },
  { label: "Pegawai Non-ASN", value: "non_asn" },
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

const createQuestion = (): SurveyQuestion => ({
  isRequired: true,
  localId: createLocalId(),
  options: [createOption("Opsi 1"), createOption("Opsi 2")],
  page: 1,
  text: "",
  type: "radio_button",
});

const getStoredToken = () =>
  localStorage.getItem(AUTH_TOKEN_KEY) ?? sessionStorage.getItem(AUTH_TOKEN_KEY);

const authHeaders = (): Record<string, string> => {
  const token = getStoredToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const isChoiceQuestion = (type: QuestionType) =>
  ["checkbox", "dropdown", "radio_button", "rating_scale"].includes(type);

const toApiDateTime = (value: string) => {
  if (!value) {
    return null;
  }

  return value.replace("T", " ") + (value.length === 16 ? ":00" : "");
};

const toNumberOrNull = (value: string) => {
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : null;
};

const readStoredDraft = (): DraftStorage => {
  try {
    const rawDraft = localStorage.getItem(DRAFT_STORAGE_KEY);
    return rawDraft ? (JSON.parse(rawDraft) as DraftStorage) : {};
  } catch {
    return {};
  }
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

export const CreateSurvey = ({
  accountDescription,
  accountName,
  isAuthenticated,
  onAuthAction,
  onBackHome,
  onOpenManageSurveys,
  onOpenProfile,
  onUnauthorized,
}: CreateSurveyProps) => {
  const storedDraft = useMemo(() => readStoredDraft(), []);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [step, setStep] = useState<BuilderStep>(1);
  const [surveyId, setSurveyId] = useState<number | null>(
    storedDraft.surveyId ?? null,
  );
  const [activePage, setActivePage] = useState(storedDraft.activePage ?? 1);
  const [surveyInfo, setSurveyInfo] = useState<SurveyInfo>({
    ...defaultSurveyInfo,
    ...(storedDraft.surveyInfo ?? {}),
  });
  const [sectionTitle, setSectionTitle] = useState(
    storedDraft.sectionTitle ?? "",
  );
  const [questions, setQuestions] = useState<SurveyQuestion[]>(
    storedDraft.questions ?? [],
  );
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [savingQuestionId, setSavingQuestionId] = useState<string | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreviewUrl, setThumbnailPreviewUrl] = useState(
    defaultThumbnailPreview,
  );
  const thumbnailObjectUrl = useRef<string | null>(null);

  useEffect(() => {
    localStorage.setItem(
      DRAFT_STORAGE_KEY,
      JSON.stringify({
        activePage,
        questions,
        sectionTitle,
        surveyId,
        surveyInfo,
      }),
    );
  }, [activePage, questions, sectionTitle, surveyId, surveyInfo]);

  useEffect(() => {
    return () => {
      if (thumbnailObjectUrl.current) {
        URL.revokeObjectURL(thumbnailObjectUrl.current);
      }
    };
  }, []);

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

  const currentPageQuestions = questions.filter(
    (question) => question.page === activePage,
  );

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

  const togglePosition = (position: string) => {
    setSurveyInfo((current) => {
      const nextPositions = current.positions.includes(position)
        ? current.positions.filter((item) => item !== position)
        : [...current.positions, position];

      return {
        ...current,
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

  const validateSurveyInfo = () => {
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

    if (
      surveyInfo.audienceMode === "limited" &&
      surveyInfo.positions.length === 0
    ) {
      nextErrors.positions = "Pilih minimal satu audiens.";
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

    const payload = buildSurveyPayload(surveyInfo);

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

  const saveSection = async (targetSurveyId: number) => {
    await requestJson(
      `/surveys/${targetSurveyId}/pages/1`,
      {
        body: JSON.stringify({ section: sectionTitle.trim() }),
        method: "PUT",
      },
      "Section belum bisa disimpan.",
    );
  };

  const goToStep = async (nextStep: BuilderStep) => {
    try {
      const targetSurveyId = await saveSurveyDraft();

      if (nextStep > 1 || step > 1) {
        await saveSection(targetSurveyId);
      }

      if (nextStep === 3 && questions.length === 0) {
        setFieldErrors({ questions: "Tambahkan minimal satu pertanyaan." });
        throw new Error("Tambahkan minimal satu pertanyaan sebelum publikasi.");
      }

      if (nextStep === 3) {
        await persistAllQuestions(targetSurveyId);
      }

      setFeedback({
        message: "Draft tersimpan otomatis.",
        type: "success",
      });
      setStep(nextStep);
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
  };

  const addQuestionPage = () => {
    const nextPage = Math.max(...questionPages) + 1;
    setActivePage(nextPage);
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

  const changeQuestionType = (localId: string, type: QuestionType) => {
    updateQuestion(localId, (question) => ({
      ...question,
      options:
        isChoiceQuestion(type) && question.options.length === 0
          ? [createOption("Opsi 1"), createOption("Opsi 2")]
          : question.options,
      type,
    }));
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
        current.filter((item) => item.localId !== question.localId),
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

    const questionPayload = {
      is_required: question.isRequired,
      page: question.page,
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
      text: questionText,
    };
  };

  const persistAllQuestions = async (targetSurveyId: number) => {
    const savedQuestions: SurveyQuestion[] = [];

    for (const question of questions) {
      savedQuestions.push(await persistQuestion(targetSurveyId, question));
    }

    setQuestions(savedQuestions);
  };

  const persistDraftQuestions = async (targetSurveyId: number) => {
    const draftQuestions = questions.filter((question) => question.text.trim());

    if (draftQuestions.length === 0) {
      return;
    }

    const savedQuestions: SurveyQuestion[] = [];

    for (const question of draftQuestions) {
      savedQuestions.push(await persistQuestion(targetSurveyId, question));
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

      if (step > 1) {
        await saveSection(targetSurveyId);
      }

      if (questions.length > 0) {
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

      if (step > 1) {
        await saveSection(targetSurveyId);
      }

      if (questions.length > 0) {
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

  const saveQuestion = async (question: SurveyQuestion) => {
    setSavingQuestionId(question.localId);

    try {
      const targetSurveyId = await saveSurveyDraft();
      const savedQuestion = await persistQuestion(targetSurveyId, question);
      setQuestions((current) =>
        current.map((item) =>
          item.localId === question.localId ? savedQuestion : item,
        ),
      );
      setFeedback({
        message: "Pertanyaan tersimpan ke draft.",
        type: "success",
      });
    } catch (error) {
      setFeedback({
        message: getOperationMessage(
          error,
          "Pertanyaan belum bisa disimpan.",
        ),
        type: "error",
      });
    } finally {
      setSavingQuestionId(null);
    }
  };

  const publishSurvey = async () => {
    if (questions.length === 0) {
      setFieldErrors({ questions: "Tambahkan minimal satu pertanyaan." });
      setFeedback({
        message: "Tambahkan minimal satu pertanyaan sebelum publikasi.",
        type: "error",
      });
      return;
    }

    setIsSaving(true);

    try {
      const targetSurveyId = await saveSurveyDraft();
      await saveSection(targetSurveyId);
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

      localStorage.removeItem(DRAFT_STORAGE_KEY);
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

  const renderStepSettings = () => (
    <section
      className="create-settings-grid"
      aria-label="Pengaturan publikasi survey"
    >
      <div className="create-settings-card">
        <header>
          <img src={calendarIcon} alt="" aria-hidden="true" />
          <h2>Jadwal Survey</h2>
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
            <span>Estimasi Waktu</span>
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
          <img src={targetIcon} alt="" aria-hidden="true" />
          <h2>Target Responden</h2>
        </header>
        <div className="create-survey-audience">
          <span>Pilih Audiens</span>
          <label>
            <input
              checked={surveyInfo.audienceMode === "all"}
              onChange={() =>
                setSurveyInfo((current) => ({
                  ...current,
                  audienceMode: "all",
                  positions: [],
                }))
              }
              type="radio"
            />
            Semua audiens
          </label>
          <label>
            <input
              checked={surveyInfo.audienceMode === "limited"}
              onChange={() =>
                setSurveyInfo((current) => ({
                  ...current,
                  audienceMode: "limited",
                  positions:
                    current.positions.length > 0 ? current.positions : ["public"],
                }))
              }
              type="radio"
            />
            Batasi audiens
          </label>

          {surveyInfo.audienceMode === "limited" && (
            <div className="create-survey-audience__checks">
              {positionOptions.map((option) => (
                <label key={option.value}>
                  <input
                    checked={surveyInfo.positions.includes(option.value)}
                    onChange={() => togglePosition(option.value)}
                    type="checkbox"
                  />
                  {option.label}
                </label>
              ))}
            </div>
          )}
          {fieldErrors.positions && <small>{fieldErrors.positions}</small>}
        </div>
      </div>
    </section>
  );

  const renderQuestionCard = (question: SurveyQuestion, index: number) => (
    <article className="create-question-card" key={question.localId}>
      <header>
        <strong>Pertanyaan {index + 1}</strong>
        <div>
          <button onClick={() => void saveQuestion(question)} type="button">
            {savingQuestionId === question.localId ? "Menyimpan..." : "Simpan"}
          </button>
          <button onClick={() => void deleteQuestion(question)} type="button">
            <img src={deleteIcon} alt="" aria-hidden="true" />
            Hapus
          </button>
        </div>
      </header>

      <div className="create-question-grid">
        <label className="create-survey-field create-survey-field--wide">
          <span>Teks Pertanyaan</span>
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

        <label className="create-survey-field">
          <span>Tipe Jawaban</span>
          <select
            onChange={(event) =>
              changeQuestionType(
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

        <label className="create-survey-field">
          <span>Halaman</span>
          <input
            min="1"
            onChange={(event) =>
              updateQuestion(question.localId, (current) => ({
                ...current,
                page: Math.max(1, Number(event.target.value) || 1),
              }))
            }
            type="number"
            value={question.page}
          />
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
          Wajib diisi
        </label>
      </div>

      {isChoiceQuestion(question.type) && (
        <div className="create-question-options">
          <span>Opsi Jawaban</span>
          {question.options.map((option, optionIndex) => (
            <div key={option.localId}>
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
                placeholder={`Opsi ${optionIndex + 1}`}
                value={option.text}
              />
              <button
                disabled={question.options.length <= 2}
                onClick={() => void removeOption(question.localId, option)}
                type="button"
              >
                <img src={deleteIcon} alt="" aria-hidden="true" />
                Hapus
              </button>
            </div>
          ))}
          <button onClick={() => addOption(question.localId)} type="button">
            <img src={addOptionIcon} alt="" aria-hidden="true" />
            Tambah Opsi
          </button>
        </div>
      )}
    </article>
  );

  const renderStepTwo = () => (
    <section className="create-question-canvas" aria-labelledby="survey-question-title">
      <div className="create-question-tabs" role="tablist" aria-label="Halaman survey">
        {questionPages.map((pageNumber) => (
          <button
            aria-selected={activePage === pageNumber}
            className={activePage === pageNumber ? "is-active" : ""}
            key={pageNumber}
            onClick={() => setActivePage(pageNumber)}
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
          <img src={plusIcon} alt="" aria-hidden="true" />
        </button>
      </div>

      <div className="create-question-title-row">
        <h2 id="survey-question-title">
          Pertanyaan Kuesioner (Halaman {activePage})
        </h2>
        <button aria-label="Ubah section" type="button">
          <img src={editIcon} alt="" aria-hidden="true" />
        </button>
      </div>

      <label className="create-section-field">
        <span>Section</span>
        <input
          onChange={(event) => setSectionTitle(event.target.value)}
          placeholder="Contoh: Pelayanan Publik"
          value={sectionTitle}
        />
      </label>

      {currentPageQuestions.length === 0 ? (
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
          {currentPageQuestions.map(renderQuestionCard)}
          <button className="create-question-add" onClick={addQuestion} type="button">
            <img src={plusIcon} alt="" aria-hidden="true" />
            Tambah Pertanyaan
          </button>
        </div>
      )}

      {fieldErrors.questions && (
        <p className="create-survey-inline-error">{fieldErrors.questions}</p>
      )}
    </section>
  );

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
        <strong>Buat Survey Baru</strong>
      </div>
    );
  };

  const renderStepIndicator = () => (
    <nav className="create-survey-steps" aria-label="Tahap buat survey">
      {([1, 2, 3] as BuilderStep[]).map((stepNumber, index) => {
        const isComplete = stepNumber < step;
        const isActive = stepNumber === step;

        return (
          <button
            className={[
              isActive ? "is-active" : "",
              isComplete ? "is-complete" : "",
            ]
              .filter(Boolean)
              .join(" ")}
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
        <div className="create-survey-content">
          <header className="create-survey-heading">
            <div>
              {renderBreadcrumbs()}
              <h1>Buat Survey Baru</h1>
              <p>{step === 1 ? stepCopy[step].description : stepCopy[step].subtitle}</p>
            </div>
            <span>{surveyId ? `Draft #${surveyId}` : "Draft baru"}</span>
          </header>

          {renderStepIndicator()}

          {feedback && (
            <p
              className={`create-survey-feedback create-survey-feedback--${feedback.type}`}
            >
              {feedback.message}
            </p>
          )}

          {step === 1 && renderStepOne()}
          {step === 2 && renderStepTwo()}
          {step === 3 && renderStepSettings()}

          <footer className="create-survey-footer">
            <button
              disabled={isSaving}
              onClick={() =>
                step === 1
                  ? void leaveBuilder()
                  : void goToStep((step - 1) as BuilderStep)
              }
              type="button"
            >
              {step !== 1 && <img src={arrowLeftIcon} alt="" aria-hidden="true" />}
              {step === 1 ? "Batal" : "Kembali"}
            </button>
            <div>
              <button
                disabled={isSaving}
                onClick={() => void saveDraftOnly()}
                type="button"
              >
                Simpan Draft
              </button>
            {step < 3 ? (
              <button
                disabled={isSaving}
                onClick={() => void goToStep((step + 1) as BuilderStep)}
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
            ) : (
              <button
                disabled={isSaving}
                onClick={() => void publishSurvey()}
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
    </main>
  );
};
