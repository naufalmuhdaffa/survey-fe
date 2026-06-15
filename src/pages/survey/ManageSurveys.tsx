import { useCallback, useEffect, useState } from "react";
import { Sidebar } from "../../components/sidebar";
import { Topbar } from "../../components/topbar";
import adminAvatar from "../../assets/home/home-admin-avatar.png";
import editIcon from "../../assets/profile/profile-edit.svg";
import limitIcon from "../../assets/survey/manage-limit-icon.svg";
import searchIcon from "../../assets/survey/manage-search-icon.svg";
import trashIcon from "../../assets/survey/manage-trash-icon.svg";
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
  onCreateSurvey?: () => void;
  onOpenProfile?: () => void;
  onUnauthorized?: () => void;
};

type ManageSurveyApiItem = {
  closes_at?: string | null;
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
  id: number | string;
  opensAt?: string | null;
  positions: string[];
  status: string;
  title: string;
};

type PaginationMeta = {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
};

type SortDirection = "asc" | "desc";
type SortKey = "opens_at" | "positions" | "status" | "title";

type SortConfig = {
  direction: SortDirection;
  key: SortKey;
};

const initialMeta: PaginationMeta = {
  page: 1,
  perPage: 5,
  total: 0,
  totalPages: 1,
};

const STATUS_LABELS: Record<string, string> = {
  closed: "CLOSED",
  draft: "DRAFT",
  open: "OPEN",
  upcoming: "UPCOMING",
};

const POSITION_LABELS: Record<string, string> = {
  asn: "Pegawai ASN",
  non_asn: "Pegawai Non-ASN",
  public: "Masyarakat",
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
  id: survey.id,
  opensAt: survey.opens_at,
  positions: Array.isArray(survey.positions) ? survey.positions : [],
  status: survey.status?.trim().toLowerCase() || "draft",
  title: survey.title?.trim() || "Survey tanpa judul",
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
    month: "long",
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
    return "umum";
  }

  return positions.map((position) => POSITION_LABELS[position] ?? position).join(", ");
};

const getStatusLabel = (status: string) => STATUS_LABELS[status] ?? status;

const getVisiblePageNumbers = (meta: PaginationMeta) => {
  const pages = new Set([1, meta.page]);

  if (meta.page < meta.totalPages) {
    pages.add(meta.page + 1);
  }

  if (meta.totalPages > 1 && pages.size < 2) {
    pages.add(meta.totalPages);
  }

  return Array.from(pages)
    .filter((pageNumber) => pageNumber >= 1 && pageNumber <= meta.totalPages)
    .sort((left, right) => left - right);
};

const buildEndpoint = (
  search: string,
  page: number,
  perPage: number,
  status: string,
  position: string,
  sortConfig: SortConfig | null,
) => {
  const params = new URLSearchParams({
    page: String(page),
    per_page: String(perPage),
  });

  if (search) {
    params.set("search", search);
  }

  if (status) {
    params.set("status", status);
  }

  if (position) {
    params.set("position", position);
  }

  if (sortConfig) {
    params.set("sort_by", sortConfig.key);
    params.set("sort_direction", sortConfig.direction);
  }

  return `${API_BASE_URL}/surveys/manage?${params.toString()}`;
};

const getSortButtonLabel = (
  label: string,
  sortConfig: SortConfig | null,
  sortKey: SortKey,
) => {
  if (sortConfig?.key !== sortKey) {
    return `Urutkan ${label} naik`;
  }

  return sortConfig.direction === "asc"
    ? `Urutkan ${label} turun`
    : `Urutkan ${label} naik`;
};

const SortableHeader = ({
  children,
  onSort,
  sortConfig,
  sortKey,
}: {
  children: string;
  onSort: (key: SortKey) => void;
  sortConfig: SortConfig | null;
  sortKey: SortKey;
}) => {
  const isActive = sortConfig?.key === sortKey;
  const direction = isActive ? sortConfig.direction : null;

  return (
    <button
      aria-label={getSortButtonLabel(children, sortConfig, sortKey)}
      aria-sort={
        isActive
          ? direction === "asc"
            ? "ascending"
            : "descending"
          : undefined
      }
      className="manage-survey-sort"
      onClick={() => onSort(sortKey)}
      type="button"
    >
      <span>{children}</span>
      <span
        aria-hidden="true"
        className={`manage-survey-sort__icons ${
          direction ? `is-${direction}` : ""
        }`}
      >
        <span className="manage-survey-sort__icon manage-survey-sort__icon--up" />
        <span className="manage-survey-sort__icon manage-survey-sort__icon--down" />
      </span>
    </button>
  );
};

const SkeletonRows = () => (
  <>
    {Array.from({ length: 5 }, (_, index) => (
      <tr className="manage-survey-skeleton" key={index}>
        <td>
          <span />
        </td>
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
  onCreateSurvey,
  onOpenProfile,
  onUnauthorized,
}: ManageSurveysProps) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [surveys, setSurveys] = useState<ManageSurvey[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>(initialMeta);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(5);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [positionFilter, setPositionFilter] = useState("");
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [feedbackMessage, setFeedbackMessage] = useState("");
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
      setFeedbackMessage("");

      try {
        const response = await fetch(
          buildEndpoint(
            searchQuery,
            page,
            perPage,
            statusFilter,
            positionFilter,
            sortConfig,
          ),
          {
            credentials: "include",
            headers: authHeaders(),
            method: "GET",
            signal,
          },
        );

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
        setFeedbackMessage(
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
    [
      isAuthenticated,
      onUnauthorized,
      page,
      perPage,
      positionFilter,
      searchQuery,
      sortConfig,
      statusFilter,
    ],
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

  const handleStatusChange = (value: string) => {
    setStatusFilter(value);
    setPage(1);
  };

  const handlePositionChange = (value: string) => {
    setPositionFilter(value);
    setPage(1);
  };

  const handleSortChange = (key: SortKey) => {
    setSortConfig((current) => ({
      direction:
        current?.key === key && current.direction === "asc" ? "desc" : "asc",
      key,
    }));
    setPage(1);
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
        title="Survey Pemkot Jogja"
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
              <h1>Kelola Survey</h1>
              <p>Manajemen data survey OPD Anda</p>
            </div>

            <button
              className="manage-survey-create"
              onClick={onCreateSurvey}
              type="button"
            >
              <span aria-hidden="true">+</span>
              Buat Survey Baru
            </button>
          </header>

          <section className="manage-survey-filters" aria-label="Filter survey">
            <label className="manage-survey-search" htmlFor="survey-search">
              <span>Cari judul survei</span>
              <img src={searchIcon} alt="" aria-hidden="true" />
              <input
                autoComplete="off"
                id="survey-search"
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Cari judul survei..."
                type="search"
                value={searchInput}
              />
            </label>

            <div className="manage-survey-filter-controls">
              <label className="manage-survey-select">
                <span>Audiens</span>
                <select
                  aria-label="Filter audiens"
                  onChange={(event) => handlePositionChange(event.target.value)}
                  value={positionFilter}
                >
                  <option value="">Audiens</option>
                  <option value="public">Masyarakat</option>
                  <option value="asn">Pegawai ASN</option>
                  <option value="non_asn">Pegawai Non-ASN</option>
                </select>
              </label>

              <label className="manage-survey-select">
                <span>Status</span>
                <select
                  aria-label="Filter status"
                  onChange={(event) => handleStatusChange(event.target.value)}
                  value={statusFilter}
                >
                  <option value="">Status</option>
                  <option value="open">Open</option>
                  <option value="upcoming">Upcoming</option>
                  <option value="closed">Closed</option>
                  <option value="draft">Draft</option>
                </select>
              </label>

              <div className="manage-survey-limit">
                <button
                  aria-expanded={isPerPageOpen}
                  aria-haspopup="listbox"
                  aria-label={`Pilih jumlah data per halaman, saat ini ${perPage}`}
                  onClick={() => setIsPerPageOpen((current) => !current)}
                  type="button"
                >
                  <img src={limitIcon} alt="" aria-hidden="true" />
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
          </section>

          {feedbackMessage && (
            <p className="manage-survey-feedback">{feedbackMessage}</p>
          )}

          <section className="manage-survey-panel" aria-label="Tabel survey">
            <div className="manage-survey-table-wrap">
              <table className="manage-survey-table" aria-busy={isLoading}>
                <thead>
                  <tr>
                    <th>
                      <SortableHeader
                        onSort={handleSortChange}
                        sortConfig={sortConfig}
                        sortKey="title"
                      >
                        Judul Survey
                      </SortableHeader>
                    </th>
                    <th>
                      <SortableHeader
                        onSort={handleSortChange}
                        sortConfig={sortConfig}
                        sortKey="opens_at"
                      >
                        Periode
                      </SortableHeader>
                    </th>
                    <th>
                      <SortableHeader
                        onSort={handleSortChange}
                        sortConfig={sortConfig}
                        sortKey="positions"
                      >
                        Audiens
                      </SortableHeader>
                    </th>
                    <th>
                      <SortableHeader
                        onSort={handleSortChange}
                        sortConfig={sortConfig}
                        sortKey="status"
                      >
                        Status
                      </SortableHeader>
                    </th>
                    <th>
                      <span className="manage-survey-table__static-head">
                        Aksi
                      </span>
                    </th>
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
                        </td>
                        <td>{formatPeriod(survey.opensAt, survey.closesAt)}</td>
                        <td>{formatPositions(survey.positions)}</td>
                        <td>
                          <span
                            className={`manage-survey-status manage-survey-status--${survey.status}`}
                          >
                            <span aria-hidden="true" />
                            {getStatusLabel(survey.status)}
                          </span>
                        </td>
                        <td>
                          <div className="manage-survey-actions">
                            <button
                              aria-label={`Ubah ${survey.title}`}
                              onClick={() =>
                                setFeedbackMessage(
                                  "Form edit survey belum tersedia.",
                                )
                              }
                              type="button"
                            >
                              <img src={editIcon} alt="" aria-hidden="true" />
                            </button>
                            <button
                              aria-label={`Hapus ${survey.title}`}
                              onClick={() =>
                                setFeedbackMessage(
                                  "Konfirmasi hapus survey belum tersedia.",
                                )
                              }
                              type="button"
                            >
                              <img
                                src={trashIcon}
                                alt=""
                                aria-hidden="true"
                                className="manage-survey-trash"
                              />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="manage-survey-empty" colSpan={5}>
                        Tidak ada survey yang cocok dengan pencarian.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <footer className="manage-survey-pagination">
              <span>
                Menampilkan {surveys.length} dari {meta.total} survey
              </span>

              <div>
                <button
                  aria-label="Halaman sebelumnya"
                  disabled={isLoading || meta.page <= 1}
                  onClick={goToPreviousPage}
                  type="button"
                >
                  &lt;
                </button>
                {getVisiblePageNumbers(meta).map((pageNumber) => (
                  <button
                    aria-current={pageNumber === meta.page ? "page" : undefined}
                    className={pageNumber === meta.page ? "is-current" : ""}
                    key={pageNumber}
                    onClick={() => setPage(pageNumber)}
                    type="button"
                  >
                    {pageNumber}
                  </button>
                ))}
                <button
                  aria-label="Halaman berikutnya"
                  disabled={isLoading || meta.page >= meta.totalPages}
                  onClick={goToNextPage}
                  type="button"
                >
                  &gt;
                </button>
              </div>
            </footer>
          </section>
        </div>
      </section>
    </main>
  );
};
