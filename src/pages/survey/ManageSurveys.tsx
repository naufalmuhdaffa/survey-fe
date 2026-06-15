import { useCallback, useEffect, useMemo, useState } from "react";
import { Sidebar } from "../../components/sidebar";
import { Topbar } from "../../components/topbar";
import adminAvatar from "../../assets/home/home-admin-avatar.png";
import "../../styles/survey/ManageSurveys.scss";

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || "http://survey-general-api.test"
).replace(/\/$/, "");

const AUTH_TOKEN_KEY = "survey_auth_token";
const PER_PAGE_OPTIONS = [5, 10, 25, 50] as const;

type ManageSurveysProps = {
  accountDescription?: string;
  accountName?: string;
  isAuthenticated: boolean;
  onAuthAction?: () => void;
  onBackHome?: () => void;
  onOpenProfile?: () => void;
  onUnauthorized?: () => void;
};

type ManageSurveyApiItem = {
  closes_at?: string | null;
  created_at?: string | null;
  creator_name?: string | null;
  description?: string | null;
  estimated_time?: number | string | null;
  id: number | string;
  opens_at?: string | null;
  positions?: string[] | null;
  question_count?: number | string | null;
  response_count?: number | string | null;
  status?: string | null;
  title?: string | null;
  updated_at?: string | null;
};

type ManageSurveyMeta = {
  page?: number | string | null;
  per_page?: number | string | null;
  total?: number | string | null;
  total_pages?: number | string | null;
};

type ManageSurveyApiResult = {
  data?: {
    items?: ManageSurveyApiItem[];
    meta?: ManageSurveyMeta;
  };
  message?: string;
};

type ManageSurvey = {
  closesAt?: string | null;
  createdAt?: string | null;
  creatorName: string;
  description: string;
  estimatedTime?: number | null;
  id: number | string;
  opensAt?: string | null;
  positions: string[];
  questionCount: number;
  responseCount: number;
  status: string;
  title: string;
  updatedAt?: string | null;
};

type PaginationMeta = {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
};

const initialMeta: PaginationMeta = {
  page: 1,
  perPage: 10,
  total: 0,
  totalPages: 1,
};

const STATUS_LABELS: Record<string, string> = {
  closed: "Selesai",
  draft: "Draft",
  open: "Aktif",
  upcoming: "Akan Datang",
};

const POSITION_LABELS: Record<string, string> = {
  asn: "ASN",
  non_asn: "Non-ASN",
  public: "Warga",
};

const getStoredToken = () =>
  localStorage.getItem(AUTH_TOKEN_KEY) ?? sessionStorage.getItem(AUTH_TOKEN_KEY);

const authHeaders = (): HeadersInit => {
  const token = getStoredToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const parseNumber = (value: number | string | null | undefined, fallback = 0) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsedValue = Number(value);
    return Number.isFinite(parsedValue) ? parsedValue : fallback;
  }

  return fallback;
};

const getApiMessage = async (response: Response) => {
  try {
    const result = (await response.json()) as ManageSurveyApiResult;
    return result.message ?? "Data kelola survey belum bisa dimuat.";
  } catch {
    return "Data kelola survey belum bisa dimuat.";
  }
};

const normalizeSurvey = (survey: ManageSurveyApiItem): ManageSurvey => ({
  closesAt: survey.closes_at,
  createdAt: survey.created_at,
  creatorName: survey.creator_name?.trim() || "-",
  description:
    survey.description?.trim() ||
    "Belum ada deskripsi singkat untuk survey ini.",
  estimatedTime: parseNumber(survey.estimated_time, 0) || null,
  id: survey.id,
  opensAt: survey.opens_at,
  positions: Array.isArray(survey.positions) ? survey.positions : [],
  questionCount: parseNumber(survey.question_count),
  responseCount: parseNumber(survey.response_count),
  status: survey.status?.trim().toLowerCase() || "draft",
  title: survey.title?.trim() || "Survey tanpa judul",
  updatedAt: survey.updated_at,
});

const normalizeMeta = (
  meta: ManageSurveyMeta | undefined,
  fallbackPerPage: number,
): PaginationMeta => ({
  page: Math.max(1, parseNumber(meta?.page, 1)),
  perPage: Math.max(1, parseNumber(meta?.per_page, fallbackPerPage)),
  total: Math.max(0, parseNumber(meta?.total)),
  totalPages: Math.max(1, parseNumber(meta?.total_pages, 1)),
});

const formatDate = (dateValue?: string | null) => {
  if (!dateValue) {
    return "-";
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
};

const formatPeriod = (opensAt?: string | null, closesAt?: string | null) => {
  const start = formatDate(opensAt);
  const end = formatDate(closesAt);

  if (start === "-" && end === "-") {
    return "-";
  }

  return `${start} - ${end}`;
};

const formatPositions = (positions: string[]) => {
  if (positions.length === 0) {
    return "Semua";
  }

  return positions.map((position) => POSITION_LABELS[position] ?? position).join(", ");
};

const getStatusLabel = (status: string) => STATUS_LABELS[status] ?? status;

const buildEndpoint = (search: string, page: number, perPage: number) => {
  const params = new URLSearchParams({
    page: String(page),
    per_page: String(perPage),
  });

  if (search) {
    params.set("search", search);
  }

  return `${API_BASE_URL}/surveys/manage?${params.toString()}`;
};

const SkeletonRows = () => (
  <>
    {Array.from({ length: 6 }, (_, index) => (
      <tr className="manage-survey-skeleton" key={index}>
        <td>
          <span />
          <small />
        </td>
        <td>
          <span />
        </td>
        <td>
          <span />
        </td>
        <td>
          <span />
        </td>
        <td>
          <span />
        </td>
        <td>
          <span />
        </td>
      </tr>
    ))}
  </>
);

export const ManageSurveys = ({
  accountDescription,
  accountName,
  isAuthenticated,
  onAuthAction,
  onBackHome,
  onOpenProfile,
  onUnauthorized,
}: ManageSurveysProps) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [surveys, setSurveys] = useState<ManageSurvey[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>(initialMeta);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [isPerPageOpen, setIsPerPageOpen] = useState(false);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      setPage(1);
      setSearchQuery(searchInput.trim());
    }, 250);

    return () => window.clearTimeout(timerId);
  }, [searchInput]);

  const fetchSurveys = useCallback(
    async (signal: AbortSignal) => {
      if (!isAuthenticated) {
        setSurveys([]);
        setMeta(initialMeta);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage("");

      try {
        const response = await fetch(buildEndpoint(searchQuery, page, perPage), {
          credentials: "include",
          headers: authHeaders(),
          method: "GET",
          signal,
        });

        if (response.status === 401) {
          onUnauthorized?.();
          return;
        }

        if (!response.ok) {
          throw new Error(await getApiMessage(response));
        }

        const result = (await response.json()) as ManageSurveyApiResult;
        const nextItems = result.data?.items ?? [];
        const nextMeta = normalizeMeta(result.data?.meta, perPage);

        setSurveys(nextItems.map(normalizeSurvey));
        setMeta(nextMeta);

        if (page !== nextMeta.page) {
          setPage(nextMeta.page);
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setSurveys([]);
        setMeta({
          page: 1,
          perPage,
          total: 0,
          totalPages: 1,
        });
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Data kelola survey belum bisa dimuat.",
        );
      } finally {
        if (!signal.aborted) {
          setIsLoading(false);
        }
      }
    },
    [isAuthenticated, onUnauthorized, page, perPage, searchQuery],
  );

  useEffect(() => {
    const controller = new AbortController();
    const timerId = window.setTimeout(() => {
      void fetchSurveys(controller.signal);
    }, 0);

    return () => {
      window.clearTimeout(timerId);
      controller.abort();
    };
  }, [fetchSurveys]);

  const summary = useMemo(
    () => ({
      active: surveys.filter((survey) => survey.status === "open").length,
      responses: surveys.reduce(
        (total, survey) => total + survey.responseCount,
        0,
      ),
      total: meta.total,
    }),
    [meta.total, surveys],
  );

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
  };

  const handleAuthAction = () => {
    closeSidebar();
    onAuthAction?.();
  };

  const handleProfileClick = () => {
    closeSidebar();
    onOpenProfile?.();
  };

  const handlePerPageChange = (nextPerPage: number) => {
    setPerPage(nextPerPage);
    setPage(1);
    setIsPerPageOpen(false);
  };

  const goToPreviousPage = () => {
    setPage((current) => Math.max(1, current - 1));
  };

  const goToNextPage = () => {
    setPage((current) => Math.min(meta.totalPages, current + 1));
  };

  return (
    <main className="manage-survey-page">
      <Topbar
        avatarSrc={adminAvatar}
        isSidebarOpen={isSidebarOpen}
        onProfileClick={handleProfileClick}
        onToggleSidebar={toggleSidebar}
        sidebarId="manage-survey-sidebar"
        title="Kelola Survey"
      />

      <Sidebar
        accountDescription={accountDescription}
        accountName={accountName}
        activeItem="Kelola Survey"
        avatarSrc={adminAvatar}
        id="manage-survey-sidebar"
        isAuthenticated={isAuthenticated}
        isOpen={isSidebarOpen}
        onAuthAction={handleAuthAction}
        onClose={closeSidebar}
        onNavigate={handleNavigationClick}
      />

      <section className="manage-survey-shell">
        <div className="manage-survey-content">
          <header className="manage-survey-heading">
            <div>
              <span>Admin Survey</span>
              <h1>Kelola Survey</h1>
              <p>
                Pantau daftar survey, status publikasi, jumlah pertanyaan, dan
                respons yang sudah masuk.
              </p>
            </div>
            <button
              disabled={isLoading}
              onClick={() => {
                const controller = new AbortController();
                void fetchSurveys(controller.signal);
              }}
              type="button"
            >
              Refresh
            </button>
          </header>

          <section className="manage-survey-summary" aria-label="Ringkasan survey">
            <div>
              <span>Total Survey</span>
              <strong>{isLoading ? "..." : summary.total}</strong>
            </div>
            <div>
              <span>Aktif di Halaman Ini</span>
              <strong>{isLoading ? "..." : summary.active}</strong>
            </div>
            <div>
              <span>Respons di Halaman Ini</span>
              <strong>{isLoading ? "..." : summary.responses}</strong>
            </div>
          </section>

          <section className="manage-survey-panel">
            <div className="manage-survey-toolbar">
              <label className="manage-survey-search" htmlFor="survey-search">
                <span>Cari Survey</span>
                <input
                  autoComplete="off"
                  id="survey-search"
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Ketik judul, status, atau pembuat..."
                  type="search"
                  value={searchInput}
                />
              </label>

              <div className="manage-survey-limit">
                <span>Data per halaman</span>
                <button
                  aria-expanded={isPerPageOpen}
                  aria-haspopup="listbox"
                  onClick={() => setIsPerPageOpen((current) => !current)}
                  type="button"
                >
                  {perPage} data
                </button>

                {isPerPageOpen && (
                  <div className="manage-survey-limit__menu" role="listbox">
                    {PER_PAGE_OPTIONS.map((option) => (
                      <button
                        aria-selected={option === perPage}
                        className={option === perPage ? "is-selected" : ""}
                        key={option}
                        onClick={() => handlePerPageChange(option)}
                        role="option"
                        type="button"
                      >
                        {option} data
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {errorMessage && (
              <p className="manage-survey-feedback">{errorMessage}</p>
            )}

            <div className="manage-survey-table-wrap">
              <table className="manage-survey-table" aria-busy={isLoading}>
                <thead>
                  <tr>
                    <th>Survey</th>
                    <th>Status</th>
                    <th>Target</th>
                    <th>Periode</th>
                    <th>Pembuat</th>
                    <th>Progress</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <SkeletonRows />
                  ) : surveys.length > 0 ? (
                    surveys.map((survey) => (
                      <tr key={survey.id}>
                        <td>
                          <strong>{survey.title}</strong>
                          <small>{survey.description}</small>
                        </td>
                        <td>
                          <span
                            className={`manage-survey-status manage-survey-status--${survey.status}`}
                          >
                            {getStatusLabel(survey.status)}
                          </span>
                        </td>
                        <td>{formatPositions(survey.positions)}</td>
                        <td>{formatPeriod(survey.opensAt, survey.closesAt)}</td>
                        <td>{survey.creatorName}</td>
                        <td>
                          <div className="manage-survey-progress">
                            <span>{survey.questionCount} pertanyaan</span>
                            <span>{survey.responseCount} respons</span>
                            {survey.estimatedTime && (
                              <span>{survey.estimatedTime} menit</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="manage-survey-empty" colSpan={6}>
                        Tidak ada survey yang cocok dengan pencarian.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <footer className="manage-survey-pagination">
              <span>
                Menampilkan {surveys.length} dari {meta.total} data
              </span>

              <div>
                <button
                  disabled={isLoading || meta.page <= 1}
                  onClick={goToPreviousPage}
                  type="button"
                >
                  Sebelumnya
                </button>
                <strong>
                  {meta.page} / {meta.totalPages}
                </strong>
                <button
                  disabled={isLoading || meta.page >= meta.totalPages}
                  onClick={goToNextPage}
                  type="button"
                >
                  Selanjutnya
                </button>
              </div>
            </footer>
          </section>
        </div>
      </section>
    </main>
  );
};
