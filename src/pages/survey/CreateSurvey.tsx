import { useEffect, useMemo, useState } from "react";
import { Sidebar } from "../../components/sidebar";
import { Topbar } from "../../components/topbar";
import adminAvatar from "../../assets/home/home-admin-avatar.png";
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

const formatAudience = (surveyInfo: SurveyInfo) => {
  if (surveyInfo.audienceMode === "all" || surveyInfo.positions.length === 0) {
    return "Semua audiens";
  }

  return surveyInfo.positions
    .map((position) => {
      const match = positionOptions.find((option) => option.value === position);
      return match?.label ?? position;
    })
    .join(", ");
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

  useEffect(() => {
    localStorage.setItem(
      DRAFT_STORAGE_KEY,
      JSON.stringify({
        questions,
        sectionTitle,
        surveyId,
        surveyInfo,
      }),
    );
  }, [questions, sectionTitle, surveyId, surveyInfo]);

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
    const question = createQuestion();
    setQuestions((current) => [...current, question]);
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
    <section className="create-survey-card" aria-labelledby="survey-info-title">
      <div className="create-survey-card__header">
        <span>1</span>
        <div>
          <h2 id="survey-info-title">Informasi Survey</h2>
          <p>Data dasar ini akan disimpan sebagai draft.</p>
        </div>
      </div>

      <div className="create-survey-form-grid">
        <label className="create-survey-field create-survey-field--wide">
          <span>Judul Survey</span>
          <input
            onChange={(event) => updateSurveyInfo("title", event.target.value)}
            placeholder="Contoh: Survey Kepuasan Layanan Dukcapil"
            value={surveyInfo.title}
          />
          {fieldErrors.title && <small>{fieldErrors.title}</small>}
        </label>

        <label className="create-survey-field create-survey-field--wide">
          <span>Deskripsi</span>
          <textarea
            onChange={(event) =>
              updateSurveyInfo("description", event.target.value)
            }
            placeholder="Ringkasan singkat tujuan survey"
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
            placeholder="Instruksi yang akan dibaca responden"
            rows={3}
            value={surveyInfo.instructions}
          />
        </label>

        <label className="create-survey-field">
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
          {fieldErrors.estimatedTime && <small>{fieldErrors.estimatedTime}</small>}
        </label>

        <label className="create-survey-field">
          <span>Mulai Publikasi</span>
          <input
            onChange={(event) => updateSurveyInfo("opensAt", event.target.value)}
            type="datetime-local"
            value={surveyInfo.opensAt}
          />
        </label>

        <label className="create-survey-field">
          <span>Selesai Publikasi</span>
          <input
            onChange={(event) => updateSurveyInfo("closesAt", event.target.value)}
            type="datetime-local"
            value={surveyInfo.closesAt}
          />
          {fieldErrors.closesAt && <small>{fieldErrors.closesAt}</small>}
        </label>

        <div className="create-survey-audience">
          <span>Audiens</span>
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
                Hapus
              </button>
            </div>
          ))}
          <button onClick={() => addOption(question.localId)} type="button">
            Tambah Opsi
          </button>
        </div>
      )}
    </article>
  );

  const renderStepTwo = () => (
    <section className="create-survey-card" aria-labelledby="survey-question-title">
      <div className="create-survey-card__header">
        <span>2</span>
        <div>
          <h2 id="survey-question-title">Pertanyaan Survey</h2>
          <p>Susun section dan pertanyaan yang akan ditampilkan.</p>
        </div>
      </div>

      <label className="create-survey-field create-survey-field--wide">
        <span>Section</span>
        <input
          onChange={(event) => setSectionTitle(event.target.value)}
          placeholder="Contoh: Pengalaman Menggunakan Layanan"
          value={sectionTitle}
        />
      </label>

      {questions.length === 0 ? (
        <div className="create-question-empty">
          <strong>Belum ada pertanyaan</strong>
          <p>Tambahkan pertanyaan pertama untuk mulai menyusun survey.</p>
          <button onClick={addQuestion} type="button">
            Tambah Pertanyaan
          </button>
        </div>
      ) : (
        <div className="create-question-list">
          {questions.map(renderQuestionCard)}
          <button className="create-question-add" onClick={addQuestion} type="button">
            Tambah Pertanyaan
          </button>
        </div>
      )}

      {fieldErrors.questions && (
        <p className="create-survey-inline-error">{fieldErrors.questions}</p>
      )}
    </section>
  );

  const renderStepThree = () => (
    <section className="create-survey-card" aria-labelledby="survey-preview-title">
      <div className="create-survey-card__header">
        <span>3</span>
        <div>
          <h2 id="survey-preview-title">Pratinjau Sebelum Publikasi</h2>
          <p>Periksa kembali isi survey sebelum dipublikasikan.</p>
        </div>
      </div>

      <div className="create-survey-preview">
        <div>
          <span>Judul</span>
          <strong>{surveyInfo.title || "-"}</strong>
        </div>
        <div>
          <span>Audiens</span>
          <strong>{formatAudience(surveyInfo)}</strong>
        </div>
        <div>
          <span>Jumlah Pertanyaan</span>
          <strong>{questions.length}</strong>
        </div>
        <div>
          <span>Status Setelah Publikasi</span>
          <strong>{getPublishStatus(surveyInfo.opensAt).toUpperCase()}</strong>
        </div>
      </div>

      <div className="create-survey-preview-section">
        <h3>{sectionTitle || "Tanpa section"}</h3>
        {questions.length === 0 ? (
          <p>Belum ada pertanyaan.</p>
        ) : (
          questions.map((question, index) => (
            <article key={question.localId}>
              <span>Pertanyaan {index + 1}</span>
              <strong>{question.text || "Pertanyaan belum diisi"}</strong>
              <small>
                {
                  questionTypes.find((type) => type.value === question.type)
                    ?.label
                }
                {question.isRequired ? " - Wajib" : " - Opsional"}
              </small>
              {isChoiceQuestion(question.type) && (
                <ul>
                  {question.options.map((option) => (
                    <li key={option.localId}>{option.text || "Opsi kosong"}</li>
                  ))}
                </ul>
              )}
            </article>
          ))
        )}
      </div>
    </section>
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
              <button onClick={() => void leaveBuilder()} type="button">
                Kembali ke Kelola Survey
              </button>
              <h1>Buat Survey Baru</h1>
              <p>Draft tersimpan otomatis saat berpindah tahap.</p>
            </div>
            <span>{surveyId ? `Draft #${surveyId}` : "Draft baru"}</span>
          </header>

          <nav className="create-survey-steps" aria-label="Tahap buat survey">
            {[1, 2, 3].map((stepNumber) => (
              <button
                className={step === stepNumber ? "is-active" : ""}
                key={stepNumber}
                onClick={() => void goToStep(stepNumber as BuilderStep)}
                type="button"
              >
                <span>{stepNumber}</span>
                {stepNumber === 1
                  ? "Informasi"
                  : stepNumber === 2
                    ? "Pertanyaan"
                    : "Publikasi"}
              </button>
            ))}
          </nav>

          {feedback && (
            <p
              className={`create-survey-feedback create-survey-feedback--${feedback.type}`}
            >
              {feedback.message}
            </p>
          )}

          {step === 1 && renderStepOne()}
          {step === 2 && renderStepTwo()}
          {step === 3 && renderStepThree()}

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
              {step === 1 ? "Batal" : "Kembali"}
            </button>
            {step < 3 ? (
              <button
                disabled={isSaving}
                onClick={() => void goToStep((step + 1) as BuilderStep)}
                type="button"
              >
                {isSaving ? "Menyimpan..." : "Simpan & Lanjut"}
              </button>
            ) : (
              <button
                disabled={isSaving}
                onClick={() => void publishSurvey()}
                type="button"
              >
                {isSaving ? "Mempublikasikan..." : "Publikasikan Survey"}
              </button>
            )}
          </footer>
        </div>
      </section>
    </main>
  );
};
