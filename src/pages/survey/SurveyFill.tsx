import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Sidebar } from "../../components/sidebar";
import { Topbar } from "../../components/topbar";
import adminAvatar from "../../assets/home/home-admin-avatar.png";
import breadcrumbChevronIcon from "../../assets/profile/profile-breadcrumb-chevron.svg";
import arrowLeftIcon from "../../assets/survey/create/create-arrow-left.svg";
import arrowRightIcon from "../../assets/survey/create/create-arrow-right.svg";
import fillAutosaveIcon from "../../assets/survey/fill/fill-autosave.svg";
import fillSaveDraftIcon from "../../assets/survey/fill/fill-save-draft.svg";
import lockIcon from "../../assets/survey/list/list-lock-icon.svg";
import { API_BASE_URL } from "../../lib/api";
import "../../styles/survey/SurveyFill.scss";

const AUTH_TOKEN_KEY = "survey_auth_token";

type SurveyFillProps = {
  accountDescription?: string;
  accountName?: string;
  isAuthenticated: boolean;
  onAuthAction?: () => void;
  onBackHome?: () => void;
  onCompleteSurvey?: (summary: { submittedAt: string; surveyId: number; title: string }) => void;
  onOpenManageSurveys?: () => void;
  onOpenProfile?: () => void;
  onOpenSurveyList?: () => void;
  onUnauthorized?: () => void;
  surveyId: number | null;
};

type ApiResult<TData = unknown> = {
  data?: TData;
  message?: string;
  status?: string;
};

type SurveyDetailApi = {
  title?: string | null;
};

type SurveyFormOptionApi = {
  id?: number | string;
  option_order?: number | string | null;
  option_text?: string | null;
};

type SurveyFormQuestionApi = {
  id?: number | string;
  is_required?: boolean | number | string | null;
  options?: SurveyFormOptionApi[];
  page?: number | string | null;
  parent_option_id?: number | string | null;
  question_order?: number | string | null;
  question_text?: string | null;
  question_type?: string | null;
};

type SurveyFormPageApi = {
  page?: number | string | null;
  questions?: SurveyFormQuestionApi[];
  section?: string | null;
};

type SurveyFormApi = {
  pages?: SurveyFormPageApi[];
  survey_id?: number | string;
};

type SurveyOption = {
  id: number;
  order: number;
  text: string;
};

type SurveyQuestion = {
  id: number;
  isRequired: boolean;
  options: SurveyOption[];
  order: number;
  page: number;
  parentOptionId: number | null;
  text: string;
  type: string;
};

type SurveyPage = {
  page: number;
  questions: SurveyQuestion[];
  section: string;
};

type AnswerValue = number | number[] | string | null;

type DraftState = {
  answers?: Record<string, AnswerValue>;
  page?: number;
};

type SubmitAnswer =
  | { answer_text: string; question_id: number }
  | { option_id: number; question_id: number }
  | { option_ids: number[]; question_id: number };

type DropdownPlacement = {
  maxHeight: number;
  openUp: boolean;
};

const DEFAULT_TITLE = "Evaluasi Pelayanan Publik 2024";
const DEFAULT_SECTION = "Pertanyaan Survey";
const LOCAL_DRAFT_PREFIX = "survey_response_draft_";

const getStoredToken = () =>
  localStorage.getItem(AUTH_TOKEN_KEY) ?? sessionStorage.getItem(AUTH_TOKEN_KEY);

const authHeaders = (): HeadersInit => {
  const token = getStoredToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const parsePositiveNumber = (value: unknown) => {
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : null;
};

const normalizeRequired = (value: SurveyFormQuestionApi["is_required"]) =>
  value === true || value === 1 || value === "1" || value === "true";

const normalizeOption = (option: SurveyFormOptionApi, index: number) => {
  const id = parsePositiveNumber(option.id);

  if (!id) {
    return null;
  }

  return {
    id,
    order: parsePositiveNumber(option.option_order) ?? index + 1,
    text: option.option_text?.trim() || `Opsi ${index + 1}`,
  };
};

const normalizeQuestion = (
  question: SurveyFormQuestionApi,
  page: number,
  index: number,
) => {
  const id = parsePositiveNumber(question.id);

  if (!id) {
    return null;
  }

  return {
    id,
    isRequired: normalizeRequired(question.is_required),
    options: (question.options ?? [])
      .map(normalizeOption)
      .filter((option): option is SurveyOption => option !== null)
      .sort((left, right) => left.order - right.order),
    order: parsePositiveNumber(question.question_order) ?? index + 1,
    page,
    parentOptionId: parsePositiveNumber(question.parent_option_id),
    text: question.question_text?.trim() || `Pertanyaan ${index + 1}`,
    type: question.question_type?.trim() || "free_text",
  };
};

const normalizeSurveyForm = (form?: SurveyFormApi): SurveyPage[] =>
  (form?.pages ?? [])
    .map((page, pageIndex) => {
      const pageNumber = parsePositiveNumber(page.page) ?? pageIndex + 1;
      const questions = (page.questions ?? [])
        .map((question, questionIndex) =>
          normalizeQuestion(question, pageNumber, questionIndex),
        )
        .filter((question): question is SurveyQuestion => question !== null)
        .sort((left, right) => left.order - right.order);

      return {
        page: pageNumber,
        questions,
        section: page.section?.trim() || `${DEFAULT_SECTION} ${pageNumber}`,
      };
    })
    .sort((left, right) => left.page - right.page);

const getQuestionTypeLabel = (type: string) => {
  if (type === "free_text") {
    return "Jawaban teks";
  }

  if (type === "radio_button") {
    return "Radio button (pilih salah satu jawaban)";
  }

  if (type === "checkbox") {
    return "Checkbox (pilih satu atau lebih jawaban)";
  }

  if (type === "dropdown") {
    return "Dropdown (pilih satu jawaban dari daftar)";
  }

  return "Pilihan";
};

const isSingleOptionType = (type: string) =>
  type === "radio_button" || type === "dropdown" || type === "rating_scale";

const getAnswerDraftKey = (surveyId: number | null) =>
  surveyId ? `${LOCAL_DRAFT_PREFIX}${surveyId}` : "";

const getSelectedOptionIds = (
  answers: Record<string, AnswerValue>,
  questions: SurveyQuestion[],
  visibleQuestionIds: Set<number>,
) => {
  const selectedOptionIds = new Set<number>();

  questions.forEach((question) => {
    if (!visibleQuestionIds.has(question.id)) {
      return;
    }

    const value = answers[String(question.id)];

    if (typeof value === "number") {
      selectedOptionIds.add(value);
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((optionId) => selectedOptionIds.add(optionId));
    }
  });

  return selectedOptionIds;
};

const getVisibleQuestionIds = (
  pages: SurveyPage[],
  answers: Record<string, AnswerValue>,
) => {
  const questions = pages.flatMap((page) => page.questions);
  const visibleQuestionIds = new Set<number>();
  let hasChanged = true;

  while (hasChanged) {
    hasChanged = false;
    const selectedOptionIds = getSelectedOptionIds(
      answers,
      questions,
      visibleQuestionIds,
    );

    questions.forEach((question) => {
      if (visibleQuestionIds.has(question.id)) {
        return;
      }

      if (question.parentOptionId === null || selectedOptionIds.has(question.parentOptionId)) {
        visibleQuestionIds.add(question.id);
        hasChanged = true;
      }
    });
  }

  return visibleQuestionIds;
};

const isAnswered = (question: SurveyQuestion, value: AnswerValue) => {
  if (question.type === "free_text") {
    return typeof value === "string" && value.trim().length > 0;
  }

  if (question.type === "checkbox") {
    const availableOptionIds = new Set(question.options.map((option) => option.id));
    return (
      Array.isArray(value) &&
      value.some((optionId) => availableOptionIds.has(optionId))
    );
  }

  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    question.options.some((option) => option.id === value)
  );
};

const buildAnswerPayload = (
  pages: SurveyPage[],
  answers: Record<string, AnswerValue>,
  visibleQuestionIds: Set<number>,
) =>
  pages
    .flatMap((page) => page.questions)
    .filter((question) => visibleQuestionIds.has(question.id))
    .reduce<SubmitAnswer[]>((payload, question) => {
      const value = answers[String(question.id)];

      if (!isAnswered(question, value)) {
        return payload;
      }

      if (question.type === "free_text" && typeof value === "string") {
        payload.push({ answer_text: value.trim(), question_id: question.id });
        return payload;
      }

      if (question.type === "checkbox" && Array.isArray(value)) {
        payload.push({ option_ids: value, question_id: question.id });
        return payload;
      }

      if (typeof value === "number") {
        payload.push({ option_id: value, question_id: question.id });
      }

      return payload;
    }, []);

export const SurveyFill = ({
  accountDescription,
  accountName,
  isAuthenticated,
  onAuthAction,
  onBackHome,
  onCompleteSurvey,
  onOpenManageSurveys,
  onOpenProfile,
  onOpenSurveyList,
  onUnauthorized,
  surveyId,
}: SurveyFillProps) => {
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState("");
  const [isLoading, setIsLoading] = useState(() => Boolean(surveyId));
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [openDropdownId, setOpenDropdownId] = useState<number | null>(null);
  const [dropdownPlacement, setDropdownPlacement] = useState<
    Record<number, DropdownPlacement>
  >({});
  const [pages, setPages] = useState<SurveyPage[]>([]);
  const [surveyTitle, setSurveyTitle] = useState(DEFAULT_TITLE);
  const dropdownButtonRefs = useRef<Record<number, HTMLButtonElement | null>>({});

  const draftKey = getAnswerDraftKey(surveyId);

  useEffect(() => {
    if (!surveyId) {
      return;
    }

    const controller = new AbortController();

    const fetchSurveyForm = async () => {
      setIsLoading(true);
      setFeedback("");

      try {
        const [formResponse, detailResponse] = await Promise.all([
          fetch(`${API_BASE_URL}/surveys/${surveyId}/form`, {
            credentials: "include",
            headers: authHeaders(),
            method: "GET",
            signal: controller.signal,
          }),
          fetch(`${API_BASE_URL}/surveys/${surveyId}`, {
            credentials: "include",
            headers: authHeaders(),
            method: "GET",
            signal: controller.signal,
          }).catch(() => null),
        ]);

        if (formResponse.status === 401) {
          onUnauthorized?.();
          return;
        }

        if (!formResponse.ok) {
          const result = (await formResponse.json().catch(() => ({}))) as ApiResult;
          throw new Error(result.message ?? "Form survey belum bisa dimuat.");
        }

        const formResult = (await formResponse.json()) as ApiResult<SurveyFormApi>;
        const nextPages = normalizeSurveyForm(formResult.data);

        if (nextPages.length === 0) {
          throw new Error("Form survey belum memiliki pertanyaan.");
        }

        if (detailResponse?.ok) {
          const detailResult = (await detailResponse.json()) as ApiResult<SurveyDetailApi>;
          setSurveyTitle(detailResult.data?.title?.trim() || DEFAULT_TITLE);
        }

        const storedDraft = localStorage.getItem(getAnswerDraftKey(surveyId));
        const draft = storedDraft ? (JSON.parse(storedDraft) as DraftState) : null;
        const draftPage = draft?.page ?? 0;

        setAnswers(draft?.answers ?? {});
        setCurrentPageIndex(
          draftPage >= 0 && draftPage < nextPages.length ? draftPage : 0,
        );
        setPages(nextPages);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setFeedback(
          error instanceof Error ? error.message : "Form survey belum bisa dimuat.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    void fetchSurveyForm();

    return () => controller.abort();
  }, [onUnauthorized, surveyId]);

  useEffect(() => {
    if (!draftKey || pages.length === 0) {
      return;
    }

    const timerId = window.setTimeout(() => {
      localStorage.setItem(
        draftKey,
        JSON.stringify({ answers, page: currentPageIndex }),
      );
    }, 300);

    return () => window.clearTimeout(timerId);
  }, [answers, currentPageIndex, draftKey, pages.length]);

  useEffect(() => {
    if (!feedback) {
      return;
    }

    const timerId = window.setTimeout(() => setFeedback(""), 4200);
    return () => window.clearTimeout(timerId);
  }, [feedback]);

  const updateDropdownPlacement = useCallback((questionId: number) => {
    const button = dropdownButtonRefs.current[questionId];

    if (!button) {
      return;
    }

    const rect = button.getBoundingClientRect();
    const gap = 8;
    const minimumHeight = 160;
    const maximumHeight = 320;
    const availableBelow = window.innerHeight - rect.bottom - gap;
    const availableAbove = rect.top - gap;
    const openUp = availableBelow < minimumHeight && availableAbove > availableBelow;
    const availableSpace = openUp ? availableAbove : availableBelow;

    setDropdownPlacement((current) => ({
      ...current,
      [questionId]: {
        maxHeight: Math.max(
          120,
          Math.min(maximumHeight, Math.floor(availableSpace)),
        ),
        openUp,
      },
    }));
  }, []);

  useEffect(() => {
    if (openDropdownId === null) {
      return;
    }

    const closeOnOutsideClick = (event: PointerEvent) => {
      const target = event.target;

      if (
        target instanceof Element &&
        target.closest(`[data-survey-fill-dropdown="${openDropdownId}"]`)
      ) {
        return;
      }

      setOpenDropdownId(null);
    };

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenDropdownId(null);
      }
    };

    const refreshPlacement = () => updateDropdownPlacement(openDropdownId);

    updateDropdownPlacement(openDropdownId);
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", refreshPlacement);
    window.addEventListener("scroll", refreshPlacement, true);

    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", refreshPlacement);
      window.removeEventListener("scroll", refreshPlacement, true);
    };
  }, [openDropdownId, updateDropdownPlacement]);

  const currentPage = pages[currentPageIndex];
  const visibleQuestionIds = useMemo(
    () => getVisibleQuestionIds(pages, answers),
    [answers, pages],
  );

  const childrenByParentOptionId = useMemo(() => {
    const children = new Map<number, SurveyQuestion[]>();

    currentPage?.questions.forEach((question) => {
      if (question.parentOptionId === null) {
        return;
      }

      const list = children.get(question.parentOptionId) ?? [];
      list.push(question);
      children.set(question.parentOptionId, list);
    });

    return children;
  }, [currentPage]);

  const totalPages = pages.length || 1;
  const progressPercent = Math.round(((currentPageIndex + 1) / totalPages) * 100);
  const currentStepLabel = currentPage
    ? `Langkah ${currentPageIndex + 1} dari ${totalPages}: ${currentPage.section}`
    : "Memuat survey";
  const completedPageIndexes = useMemo(
    () =>
      pages.map((page) =>
        page.questions.every((question) => {
          if (!visibleQuestionIds.has(question.id) || !question.isRequired) {
            return true;
          }

          return isAnswered(question, answers[String(question.id)]);
        }),
      ),
    [answers, pages, visibleQuestionIds],
  );
  const unlockedPageIndexes = useMemo(() => {
    const nextUnlockedIndexes = new Set<number>();
    let canVisitNextPage = true;

    pages.forEach((_, pageIndex) => {
      if (pageIndex === 0 || canVisitNextPage) {
        nextUnlockedIndexes.add(pageIndex);
      }

      if (!completedPageIndexes[pageIndex]) {
        canVisitNextPage = false;
      }
    });

    return nextUnlockedIndexes;
  }, [completedPageIndexes, pages]);

  const closeSidebar = () => {
    setIsSidebarOpen(false);
  };

  const toggleSidebar = () => {
    setIsSidebarOpen((current) => !current);
  };

  const handleNavigationClick = (label: string) => {
    closeSidebar();

    if (label === "Dashboard") {
      onBackHome?.();
    }

    if (label === "Daftar Survey") {
      onOpenSurveyList?.();
    }

    if (label === "Kelola Survey") {
      onOpenManageSurveys?.();
    }
  };

  const updateAnswer = (questionId: number, value: AnswerValue) => {
    setAnswers((current) => ({ ...current, [questionId]: value }));
    setErrors((current) => {
      const nextErrors = { ...current };
      delete nextErrors[String(questionId)];
      return nextErrors;
    });
  };

  const validatePages = (pageIndexes: number[]) => {
    const nextErrors: Record<string, string> = {};

    pageIndexes.forEach((pageIndex) => {
      pages[pageIndex]?.questions.forEach((question) => {
        if (!visibleQuestionIds.has(question.id) || !question.isRequired) {
          return;
        }

        if (!isAnswered(question, answers[String(question.id)])) {
          nextErrors[String(question.id)] = "Pertanyaan wajib diisi.";
        }
      });
    });

    setErrors((current) => ({ ...current, ...nextErrors }));
    return nextErrors;
  };

  const focusFirstError = (nextErrors: Record<string, string>) => {
    const firstQuestionId = Number(Object.keys(nextErrors)[0]);
    const pageIndex = pages.findIndex((page) =>
      page.questions.some((question) => question.id === firstQuestionId),
    );

    if (pageIndex >= 0) {
      setCurrentPageIndex(pageIndex);
    }
  };

  const handleSaveDraft = () => {
    if (!draftKey) {
      return;
    }

    localStorage.setItem(
      draftKey,
      JSON.stringify({ answers, page: currentPageIndex }),
    );
    setFeedback("Draft jawaban berhasil disimpan di perangkat ini.");
  };

  const toggleDropdown = (questionId: number) => {
    setOpenDropdownId((current) => {
      if (current === questionId) {
        return null;
      }

      window.requestAnimationFrame(() => updateDropdownPlacement(questionId));
      return questionId;
    });
  };

  const handlePrevious = () => {
    setCurrentPageIndex((current) => Math.max(0, current - 1));
  };

  const handleNext = () => {
    const nextErrors = validatePages([currentPageIndex]);

    if (Object.keys(nextErrors).length > 0) {
      setFeedback("Lengkapi pertanyaan wajib sebelum lanjut.");
      focusFirstError(nextErrors);
      return;
    }

    setCurrentPageIndex((current) => Math.min(pages.length - 1, current + 1));
  };

  const handleProgressClick = (targetPageIndex: number) => {
    if (isLoading || targetPageIndex === currentPageIndex) {
      return;
    }

    if (unlockedPageIndexes.has(targetPageIndex)) {
      setCurrentPageIndex(targetPageIndex);
      return;
    }

    const firstBlockedPageIndex = completedPageIndexes.findIndex(
      (isComplete, pageIndex) => pageIndex < targetPageIndex && !isComplete,
    );
    const nextErrors = validatePages([
      firstBlockedPageIndex >= 0 ? firstBlockedPageIndex : currentPageIndex,
    ]);

    setFeedback("Lengkapi pertanyaan wajib sebelum membuka langkah ini.");

    if (Object.keys(nextErrors).length > 0) {
      focusFirstError(nextErrors);
    }
  };

  const handleSubmit = async () => {
    if (!isAuthenticated) {
      setFeedback("Silakan login terlebih dahulu untuk mengirim survey.");
      onAuthAction?.();
      return;
    }

    const nextErrors = validatePages(pages.map((_, index) => index));

    if (Object.keys(nextErrors).length > 0) {
      setFeedback("Lengkapi seluruh pertanyaan wajib sebelum mengirim survey.");
      focusFirstError(nextErrors);
      return;
    }

    if (!surveyId) {
      setFeedback("Survey tidak ditemukan.");
      return;
    }

    const payload = {
      answers: buildAnswerPayload(pages, answers, visibleQuestionIds),
    };

    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/surveys/${surveyId}/responses`, {
        body: JSON.stringify(payload),
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        method: "POST",
      });

      if (response.status === 401) {
        onUnauthorized?.();
        return;
      }

      if (!response.ok) {
        const result = (await response.json().catch(() => ({}))) as ApiResult;
        throw new Error(result.message ?? "Jawaban survey belum bisa dikirim.");
      }

      if (draftKey) {
        localStorage.removeItem(draftKey);
      }

      onCompleteSurvey?.({
        submittedAt: new Date().toISOString(),
        surveyId,
        title: surveyTitle,
      });
    } catch (error) {
      setFeedback(
        error instanceof Error ? error.message : "Jawaban survey belum bisa dikirim.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleCheckbox = (question: SurveyQuestion, optionId: number) => {
    const currentValue = answers[String(question.id)];
    const currentOptionIds = Array.isArray(currentValue) ? currentValue : [];
    const nextOptionIds = currentOptionIds.includes(optionId)
      ? currentOptionIds.filter((currentOptionId) => currentOptionId !== optionId)
      : [...currentOptionIds, optionId];

    updateAnswer(question.id, nextOptionIds);
  };

  const renderQuestionChildren = (optionId: number, nestingLevel: number) => {
    const children = childrenByParentOptionId.get(optionId) ?? [];

    if (children.length === 0) {
      return null;
    }

    return (
      <div className="survey-fill-children">
        {children
          .filter((question) => visibleQuestionIds.has(question.id))
          .map((question) => renderQuestion(question, nestingLevel + 1))}
      </div>
    );
  };

  const renderOptionList = (question: SurveyQuestion, nestingLevel: number) => {
    const value = answers[String(question.id)];
    const isCheckbox = question.type === "checkbox";

    return (
      <div className="survey-fill-options">
        {question.options.map((option) => {
          const isSelected = isCheckbox
            ? Array.isArray(value) && value.includes(option.id)
            : value === option.id;

          return (
            <div className="survey-fill-option-wrap" key={option.id}>
              <label
                className={[
                  "survey-fill-option",
                  isCheckbox ? "is-checkbox" : "is-radio",
                  isSelected ? "is-selected" : "",
                  nestingLevel > 0 ? "is-compact" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <input
                  checked={isSelected}
                  name={`question-${question.id}`}
                  onChange={() => {
                    if (isCheckbox) {
                      toggleCheckbox(question, option.id);
                      return;
                    }

                    updateAnswer(question.id, option.id);
                  }}
                  type={isCheckbox ? "checkbox" : "radio"}
                />
                <span aria-hidden="true" />
                {option.text}
              </label>

              {isSelected && renderQuestionChildren(option.id, nestingLevel)}
            </div>
          );
        })}
      </div>
    );
  };

  const renderQuestionInput = (question: SurveyQuestion, nestingLevel: number) => {
    const value = answers[String(question.id)];

    if (question.type === "free_text") {
      return (
        <textarea
          aria-label={question.text}
          onChange={(event) => updateAnswer(question.id, event.target.value)}
          placeholder="Tuliskan jawaban Anda di sini..."
          value={typeof value === "string" ? value : ""}
        />
      );
    }

    if (question.type === "dropdown") {
      const selectedOption =
        typeof value === "number"
          ? question.options.find((option) => option.id === value)
          : null;
      const isOpen = openDropdownId === question.id;
      const placement = dropdownPlacement[question.id];

      return (
        <>
          <div
            className={[
              "survey-fill-dropdown",
              isOpen ? "is-open" : "",
              placement?.openUp ? "is-open-up" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            data-survey-fill-dropdown={question.id}
          >
            <button
              aria-expanded={isOpen}
              aria-haspopup="listbox"
              className={selectedOption ? "" : "is-placeholder"}
              onClick={() => toggleDropdown(question.id)}
              ref={(element) => {
                dropdownButtonRefs.current[question.id] = element;
              }}
              type="button"
            >
              <span>{selectedOption?.text ?? "Pilih jawaban"}</span>
              <i aria-hidden="true" />
            </button>

            {isOpen && (
              <div
                className="survey-fill-dropdown__menu"
                role="listbox"
                style={{ maxHeight: `${placement?.maxHeight ?? 280}px` }}
              >
                <button
                  aria-selected={!selectedOption}
                  onClick={() => {
                    updateAnswer(question.id, null);
                    setOpenDropdownId(null);
                  }}
                  role="option"
                  type="button"
                >
                  Pilih jawaban
                </button>
                {question.options.map((option) => (
                  <button
                    aria-selected={selectedOption?.id === option.id}
                    key={option.id}
                    onClick={() => {
                      updateAnswer(question.id, option.id);
                      setOpenDropdownId(null);
                    }}
                    role="option"
                    type="button"
                  >
                    {option.text}
                  </button>
                ))}
              </div>
            )}
          </div>
          {selectedOption && renderQuestionChildren(selectedOption.id, nestingLevel)}
        </>
      );
    }

    if (isSingleOptionType(question.type) || question.type === "checkbox") {
      return renderOptionList(question, nestingLevel);
    }

    return (
      <p className="survey-fill-unsupported">
        Tipe pertanyaan {getQuestionTypeLabel(question.type)} belum didukung.
      </p>
    );
  };

  const renderQuestion = (question: SurveyQuestion, nestingLevel = 0) => {
    if (!visibleQuestionIds.has(question.id)) {
      return null;
    }

    const hasError = Boolean(errors[String(question.id)]);

    return (
      <section
        className={[
          "survey-fill-question",
          nestingLevel > 0 ? "survey-fill-question--child" : "",
          hasError ? "has-error" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        key={question.id}
      >
        <div className="survey-fill-question__heading">
          {nestingLevel === 0 && (
            <span aria-hidden="true">{question.order}</span>
          )}
          <div>
            <h3>{question.text}</h3>
            <p>{getQuestionTypeLabel(question.type)}</p>
          </div>
          {question.isRequired && <strong>Wajib diisi</strong>}
        </div>

        <div className="survey-fill-question__body">
          {renderQuestionInput(question, nestingLevel)}
          {hasError && <small>{errors[String(question.id)]}</small>}
        </div>
      </section>
    );
  };

  const topLevelQuestions =
    currentPage?.questions.filter((question) => question.parentOptionId === null) ?? [];

  return (
    <main className="survey-fill-page">
      <Topbar
        avatarSrc={adminAvatar}
        isSidebarOpen={isSidebarOpen}
        onProfileClick={() => {
          closeSidebar();
          onOpenProfile?.();
        }}
        onToggleSidebar={toggleSidebar}
        sidebarId="survey-fill-sidebar"
        title="Survey Pemkot Jogja"
      />

      <Sidebar
        accountDescription={accountDescription}
        accountName={accountName}
        activeItem="Daftar Survey"
        avatarSrc={adminAvatar}
        id="survey-fill-sidebar"
        isAuthenticated={isAuthenticated}
        isOpen={isSidebarOpen}
        onAuthAction={() => {
          closeSidebar();
          onAuthAction?.();
        }}
        onClose={closeSidebar}
        onNavigate={handleNavigationClick}
      />

      <section className="survey-fill-shell">
        {feedback && (
          <p className="survey-fill-toast" role="status">
            {feedback}
          </p>
        )}

        <div className="survey-fill-content">
          <nav className="survey-fill-breadcrumb" aria-label="Breadcrumb">
            <button onClick={onBackHome} type="button">
              Beranda
            </button>
            <img src={breadcrumbChevronIcon} alt="" aria-hidden="true" />
            <button onClick={onOpenSurveyList} type="button">
              Daftar Survey
            </button>
            <img src={breadcrumbChevronIcon} alt="" aria-hidden="true" />
            <span>Isi Survey</span>
          </nav>

          <header className="survey-fill-header">
            <h1>Isi Survey: {surveyTitle}</h1>
            <p>
              Kontribusi Anda membantu kami mewujudkan pelayanan yang lebih baik
              bagi masyarakat Yogyakarta.
            </p>
          </header>

          <section className="survey-fill-progress" aria-label="Progress pengisian">
            <div>
              <strong>{currentStepLabel}</strong>
              <span>{progressPercent}% Selesai</span>
            </div>
            <div className="survey-fill-progress__bars">
              {Array.from({ length: totalPages }, (_, index) => {
                const isCurrentStep = index === currentPageIndex;
                const isStepComplete = completedPageIndexes[index];
                const isStepUnlocked = unlockedPageIndexes.has(index);

                return (
                  <button
                    aria-current={isCurrentStep ? "step" : undefined}
                    aria-label={`Buka ${pages[index]?.section ?? `langkah ${index + 1}`}${
                      isStepUnlocked ? "" : " (terkunci)"
                    }`}
                    className={[
                      isCurrentStep ? "is-current" : "",
                      isStepComplete ? "is-complete" : "",
                      isStepUnlocked ? "is-unlocked" : "is-locked",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    disabled={isLoading}
                    key={index}
                    onClick={() => handleProgressClick(index)}
                    type="button"
                  >
                    {!isStepUnlocked && (
                      <img src={lockIcon} alt="" aria-hidden="true" />
                    )}
                  </button>
                );
              })}
            </div>
            <div className="survey-fill-progress__labels">
              {pages.map((page, index) => (
                <span className={index === currentPageIndex ? "is-active" : ""} key={page.page}>
                  {page.section}
                </span>
              ))}
            </div>
          </section>

          <section className="survey-fill-card" aria-busy={isLoading}>
            {isLoading ? (
              <div className="survey-fill-skeleton">
                <i />
                <i />
                <i />
                <i />
              </div>
            ) : currentPage ? (
              <>
                <div className="survey-fill-card__head">
                  <h2>{currentPage.section}</h2>
                  <span>Wajib diisi</span>
                </div>

                <div className="survey-fill-card__questions">
                  {topLevelQuestions.map((question) => renderQuestion(question))}
                </div>

                <div className="survey-fill-actions">
                  <div>
                    <button
                      className="survey-fill-actions__back"
                      disabled={currentPageIndex === 0}
                      onClick={handlePrevious}
                      type="button"
                    >
                      <img src={arrowLeftIcon} alt="" aria-hidden="true" />
                      Kembali
                    </button>
                    <button
                      className="survey-fill-actions__draft"
                      onClick={handleSaveDraft}
                      type="button"
                    >
                      <img src={fillSaveDraftIcon} alt="" aria-hidden="true" />
                      Simpan Draft
                    </button>
                  </div>

                  <p className="survey-fill-autosave">
                    <img src={fillAutosaveIcon} alt="" aria-hidden="true" />
                    Draft disimpan otomatis ke langkah ini
                  </p>

                  {currentPageIndex === pages.length - 1 ? (
                    <button
                      className="survey-fill-actions__primary"
                      disabled={isSubmitting}
                      onClick={() => void handleSubmit()}
                      type="button"
                    >
                      {isSubmitting ? "Mengirim..." : "Kirim Survey"}
                      <img src={arrowRightIcon} alt="" aria-hidden="true" />
                    </button>
                  ) : (
                    <button
                      className="survey-fill-actions__primary"
                      onClick={handleNext}
                      type="button"
                    >
                      Selanjutnya
                      <img src={arrowRightIcon} alt="" aria-hidden="true" />
                    </button>
                  )}
                </div>
              </>
            ) : (
              <div className="survey-fill-success">
                <h2>Form survey belum tersedia.</h2>
                <p>Silakan kembali ke daftar survey dan coba lagi nanti.</p>
                <button onClick={onOpenSurveyList} type="button">
                  Kembali ke Daftar Survey
                </button>
              </div>
            )}
          </section>
        </div>
      </section>
    </main>
  );
};
