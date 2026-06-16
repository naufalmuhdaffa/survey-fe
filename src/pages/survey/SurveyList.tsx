import { useEffect, useMemo, useState } from "react";
import { Sidebar } from "../../components/sidebar";
import { Topbar } from "../../components/topbar";
import adminAvatar from "../../assets/home/home-admin-avatar.png";
import cardArrowIcon from "../../assets/home/home-card-arrow.svg";
import surveyIllustration from "../../assets/home/home-survey-illustration.png";
import transJogjaBus from "../../assets/home/home-trans-jogja-bus.png";
import limitIcon from "../../assets/survey/manage-limit-icon.svg";
import searchIcon from "../../assets/survey/manage-search-icon.svg";
import { API_BASE_URL } from "../../lib/api";
import "../../styles/survey/SurveyList.scss";

const AUTH_TOKEN_KEY = "survey_auth_token";
const SURVEYS_PER_PAGE = 3;

type SurveyListProps = {
  accountDescription?: string;
  accountName?: string;
  isAuthenticated: boolean;
  onAuthAction?: () => void;
  onBackHome?: () => void;
  onOpenManageSurveys?: () => void;
  onOpenProfile?: () => void;
  onUnauthorized?: () => void;
};

type SurveyApiItem = {
  closes_at?: string | null;
  description?: string | null;
  estimated_time?: number | string | null;
  id: number | string;
  opens_at?: string | null;
  positions?: string[] | string | null;
  status?: string | null;
  thumbnail?: string | null;
  thumbnail_path?: string | null;
  title?: string | null;
};

type SurveyApiResult = {
  data?: SurveyApiItem[] | { items?: SurveyApiItem[]; surveys?: SurveyApiItem[] };
  message?: string;
};

type SurveyCard = {
  closesAt?: string | null;
  description: string;
  estimatedTime?: number | null;
  id: number | string;
  image?: string | null;
  opensAt?: string | null;
  positions: string[];
  status: string;
  title: string;
};

const POSITION_LABELS: Record<string, string> = {
  asn: "Pegawai ASN",
  non_asn: "Pegawai Non-ASN",
  public: "Masyarakat Umum",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  open: "Open",
  upcoming: "Upcoming",
};

const fallbackSurveys: SurveyCard[] = [
  {
    closesAt: "2026-10-24",
    description:
      "Survei ini bertujuan untuk mengukur tingkat kepuasan masyarakat terhadap layanan rute baru Trans Jogja, termasuk ketepatan waktu, kebersihan halte, dan kenyamanan armada.",
    estimatedTime: 8,
    id: "fallback-open",
    image: surveyIllustration,
    opensAt: "2026-09-24",
    positions: ["public"],
    status: "open",
    title: "Evaluasi Pelayanan Transportasi Publik (Trans Jogja)",
  },
  {
    closesAt: "2026-11-12",
    description:
      "Mendukung evaluasi layanan dan fasilitas kota melalui masukan dari pegawai dan warga yang menggunakan layanan pemerintah.",
    estimatedTime: 10,
    id: "fallback-upcoming",
    image: transJogjaBus,
    opensAt: "2026-10-12",
    positions: ["asn"],
    status: "upcoming",
    title: "Evaluasi Pelayanan Publik Kota Yogyakarta",
  },
  {
    closesAt: "2026-12-08",
    description:
      "Draft survei untuk memetakan kebutuhan responden sebelum dipublikasikan kepada target audiens yang sesuai.",
    estimatedTime: 6,
    id: "fallback-draft",
    image: surveyIllustration,
    opensAt: "2026-11-08",
    positions: ["asn", "non_asn"],
    status: "draft",
    title: "Pemetaan Kebutuhan Layanan Digital OPD",
  },
];

const getStoredToken = () =>
  localStorage.getItem(AUTH_TOKEN_KEY) ?? sessionStorage.getItem(AUTH_TOKEN_KEY);

const authHeaders = (): HeadersInit => {
  const token = getStoredToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const extractSurveys = (result: SurveyApiResult) => {
  if (Array.isArray(result.data)) {
    return result.data;
  }

  if (Array.isArray(result.data?.items)) {
    return result.data.items;
  }

  if (Array.isArray(result.data?.surveys)) {
    return result.data.surveys;
  }

  return [];
};

const normalizePositions = (positions?: string[] | string | null) => {
  if (Array.isArray(positions)) {
    return positions.filter(Boolean);
  }

  if (typeof positions === "string") {
    return positions
      .split(",")
      .map((position) => position.trim())
      .filter(Boolean);
  }

  return [];
};

const normalizeEstimatedTime = (value?: number | string | null) => {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }

  if (typeof value === "string") {
    const parsedValue = Number(value);
    return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : null;
  }

  return null;
};

const normalizeSurvey = (survey: SurveyApiItem): SurveyCard => ({
  closesAt: survey.closes_at,
  description:
    survey.description?.trim() ||
    "Survei Pemerintah Kota Yogyakarta yang membutuhkan partisipasi Anda.",
  estimatedTime: normalizeEstimatedTime(survey.estimated_time),
  id: survey.id,
  image: survey.thumbnail_path ?? survey.thumbnail,
  opensAt: survey.opens_at,
  positions: normalizePositions(survey.positions),
  status: survey.status?.trim().toLowerCase() || "draft",
  title: survey.title?.trim() || "Survey Pemerintah Kota Yogyakarta",
});

const resolveImageUrl = (path?: string | null) => {
  if (!path) {
    return surveyIllustration;
  }

  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
};

const getPositionBadges = (positions: string[]) => {
  if (positions.length === 0 || positions.includes("public")) {
    return ["Masyarakat Umum"];
  }

  return Array.from(
    new Set(positions.map((position) => POSITION_LABELS[position] ?? position)),
  );
};

const formatDate = (dateValue?: string | null) => {
  if (!dateValue) {
    return null;
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
    .format(date)
    .replace(/\./g, "");
};

const getEndDateLabel = (closesAt?: string | null) => {
  const endDate = formatDate(closesAt);
  return endDate ? `Berakhir: ${endDate}` : "Tanpa tanggal selesai";
};

const getStatusLabel = (status: string) => STATUS_LABELS[status] ?? status;

const getVisiblePageNumbers = (currentPage: number, totalPages: number) => {
  const pages = new Set([1, currentPage]);

  if (currentPage > 1) {
    pages.add(currentPage - 1);
  }

  if (currentPage < totalPages) {
    pages.add(currentPage + 1);
  }

  return Array.from(pages)
    .filter((pageNumber) => pageNumber >= 1 && pageNumber <= totalPages)
    .sort((left, right) => left - right);
};

const matchesPosition = (survey: SurveyCard, position: string) => {
  if (!position) {
    return true;
  }

  if (position === "public") {
    return survey.positions.length === 0 || survey.positions.includes("public");
  }

  return survey.positions.includes(position);
};

const SurveyListSkeleton = () => (
  <>
    {Array.from({ length: 3 }, (_, index) => (
      <article className="survey-list-card survey-list-card--skeleton" key={index}>
        <span />
        <div>
          <i />
          <i />
          <i />
          <i />
        </div>
      </article>
    ))}
  </>
);

export const SurveyList = ({
  accountDescription,
  accountName,
  isAuthenticated,
  onAuthAction,
  onBackHome,
  onOpenManageSurveys,
  onOpenProfile,
  onUnauthorized,
}: SurveyListProps) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [surveys, setSurveys] = useState<SurveyCard[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [positionFilter, setPositionFilter] = useState("");
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [feedbackMessage, setFeedbackMessage] = useState("");

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      setSearchQuery(searchInput.trim().toLowerCase());
      setPage(1);
    }, 200);

    return () => window.clearTimeout(timerId);
  }, [searchInput]);

  useEffect(() => {
    const controller = new AbortController();

    const fetchSurveys = async () => {
      setIsLoading(true);
      setFeedbackMessage("");

      try {
        const response = await fetch(`${API_BASE_URL}/surveys`, {
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
          throw new Error("Daftar survey belum bisa dimuat.");
        }

        const result = (await response.json()) as SurveyApiResult;
        const nextSurveys = extractSurveys(result)
          .map(normalizeSurvey)
          .filter((survey) => survey.status !== "closed");

        setSurveys(nextSurveys);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setSurveys([]);
        setFeedbackMessage(
          error instanceof Error
            ? error.message
            : "Daftar survey belum bisa dimuat.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    void fetchSurveys();

    return () => controller.abort();
  }, [onUnauthorized]);

  const filteredSurveys = useMemo(() => {
    const source = surveys.length > 0 ? surveys : fallbackSurveys;

    return source.filter((survey) => {
      const matchesSearch =
        searchQuery === "" ||
        survey.title.toLowerCase().includes(searchQuery) ||
        survey.description.toLowerCase().includes(searchQuery);
      const matchesStatus = !statusFilter || survey.status === statusFilter;

      return (
        survey.status !== "closed" &&
        matchesSearch &&
        matchesStatus &&
        matchesPosition(survey, positionFilter)
      );
    });
  }, [positionFilter, searchQuery, statusFilter, surveys]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredSurveys.length / SURVEYS_PER_PAGE),
  );
  const currentPage = Math.min(page, totalPages);
  const visibleSurveys = filteredSurveys.slice(
    (currentPage - 1) * SURVEYS_PER_PAGE,
    currentPage * SURVEYS_PER_PAGE,
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

    if (label === "Kelola Survey") {
      onOpenManageSurveys?.();
    }
  };

  const handleProfileClick = () => {
    closeSidebar();
    onOpenProfile?.();
  };

  const handleAuthAction = () => {
    closeSidebar();
    onAuthAction?.();
  };

  const resetFilters = () => {
    setSearchInput("");
    setSearchQuery("");
    setStatusFilter("");
    setPositionFilter("");
    setPage(1);
  };

  const handleStartSurvey = async (survey: SurveyCard) => {
    if (survey.status !== "open") {
      setFeedbackMessage("Survey ini belum dapat diisi.");
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/surveys/${survey.id}/form`, {
        credentials: "include",
        headers: authHeaders(),
        method: "GET",
      });

      if (response.status === 401) {
        onUnauthorized?.();
        return;
      }

      if (!response.ok) {
        throw new Error("Form survey belum bisa dibuka.");
      }

      setFeedbackMessage("Form survey siap dibuka.");
    } catch (error) {
      setFeedbackMessage(
        error instanceof Error ? error.message : "Form survey belum bisa dibuka.",
      );
    }
  };

  return (
    <main className="survey-list-page">
      <Topbar
        avatarSrc={adminAvatar}
        isSidebarOpen={isSidebarOpen}
        onProfileClick={handleProfileClick}
        onToggleSidebar={toggleSidebar}
        sidebarId="survey-list-sidebar"
        title="Survey Pemkot Jogja"
      />

      <Sidebar
        accountDescription={accountDescription}
        accountName={accountName}
        activeItem="Daftar Survey"
        avatarSrc={adminAvatar}
        id="survey-list-sidebar"
        isAuthenticated={isAuthenticated}
        isOpen={isSidebarOpen}
        onAuthAction={handleAuthAction}
        onClose={closeSidebar}
        onNavigate={handleNavigationClick}
      />

      <section className="survey-list-shell">
        <div className="survey-list-content">
          <header className="survey-list-heading">
            <h1>Daftar Survey</h1>
            <p>Temukan survey yang tersedia dan pantau status pembukaannya.</p>
          </header>

          <section className="survey-list-filters" aria-label="Filter survey">
            <label className="survey-list-search" htmlFor="survey-list-search">
              <span>Cari judul survei</span>
              <img src={searchIcon} alt="" aria-hidden="true" />
              <input
                autoComplete="off"
                id="survey-list-search"
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Cari judul survei..."
                type="search"
                value={searchInput}
              />
            </label>

            <div className="survey-list-filter-controls">
              <label>
                <span>Kategori</span>
                <select
                  aria-label="Filter kategori"
                  onChange={(event) => {
                    setPositionFilter(event.target.value);
                    setPage(1);
                  }}
                  value={positionFilter}
                >
                  <option value="">Kategori</option>
                  <option value="public">Masyarakat Umum</option>
                  <option value="asn">Pegawai ASN</option>
                  <option value="non_asn">Pegawai Non-ASN</option>
                </select>
              </label>

              <label>
                <span>Status</span>
                <select
                  aria-label="Filter status"
                  onChange={(event) => {
                    setStatusFilter(event.target.value);
                    setPage(1);
                  }}
                  value={statusFilter}
                >
                  <option value="">Status</option>
                  <option value="open">Open</option>
                  <option value="upcoming">Upcoming</option>
                  <option value="draft">Draft</option>
                </select>
              </label>

              <button
                aria-label="Reset filter survey"
                onClick={resetFilters}
                type="button"
              >
                <img src={limitIcon} alt="" aria-hidden="true" />
              </button>
            </div>
          </section>

          {feedbackMessage && (
            <p className="survey-list-feedback" role="status">
              {feedbackMessage}
            </p>
          )}

          <section className="survey-list-grid" aria-busy={isLoading}>
            {isLoading ? (
              <SurveyListSkeleton />
            ) : visibleSurveys.length > 0 ? (
              visibleSurveys.map((survey) => (
                <article className="survey-list-card" key={survey.id}>
                  <div className="survey-list-card__media">
                    <img
                      alt=""
                      onError={(event) => {
                        event.currentTarget.src = surveyIllustration;
                      }}
                      src={resolveImageUrl(survey.image)}
                    />
                  </div>

                  <div className="survey-list-card__body">
                    <span
                      className={`survey-list-status survey-list-status--${survey.status}`}
                    >
                      <span aria-hidden="true" />
                      {getStatusLabel(survey.status)}
                    </span>

                    <div className="survey-list-card__meta">
                      <div>
                        {getPositionBadges(survey.positions).map((label) => (
                          <span key={label}>{label}</span>
                        ))}
                      </div>
                      <small>{getEndDateLabel(survey.closesAt)}</small>
                    </div>

                    <h2>{survey.title}</h2>
                    <p>{survey.description}</p>

                    <div className="survey-list-card__footer">
                      <span>
                        Estimasi {survey.estimatedTime ?? 8} menit
                      </span>
                      <button
                        disabled={survey.status !== "open"}
                        onClick={() => void handleStartSurvey(survey)}
                        type="button"
                      >
                        {survey.status === "open" ? "Mulai Survei" : "Belum Aktif"}
                        <img src={cardArrowIcon} alt="" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <div className="survey-list-empty">
                <h2>Survey tidak ditemukan</h2>
                <p>Coba ubah kata kunci atau filter yang digunakan.</p>
              </div>
            )}
          </section>

          <nav className="survey-list-pagination" aria-label="Pagination survey">
            <button
              aria-label="Halaman sebelumnya"
              disabled={currentPage === 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              type="button"
            >
              {"<"}
            </button>

            {getVisiblePageNumbers(currentPage, totalPages).map((pageNumber) => (
              <button
                aria-current={pageNumber === currentPage ? "page" : undefined}
                className={pageNumber === currentPage ? "is-active" : ""}
                key={pageNumber}
                onClick={() => setPage(pageNumber)}
                type="button"
              >
                {pageNumber}
              </button>
            ))}

            {totalPages > 3 && currentPage < totalPages - 1 && <span>...</span>}

            <button
              aria-label="Halaman berikutnya"
              disabled={currentPage === totalPages}
              onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
              type="button"
            >
              {">"}
            </button>
          </nav>

          <footer className="survey-list-footer">
            <p>&copy; 2026 Pemerintah Kota Yogyakarta. Hak Cipta Dilindungi.</p>
            <div>
              <span>Kebijakan Privasi</span>
              <span>Syarat & Ketentuan</span>
              <span>Kontak</span>
            </div>
          </footer>
        </div>
      </section>
    </main>
  );
};
