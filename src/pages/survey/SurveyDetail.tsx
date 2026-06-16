import { useEffect, useMemo, useState } from "react";
import { Sidebar } from "../../components/sidebar";
import { Topbar } from "../../components/topbar";
import adminAvatar from "../../assets/home/home-admin-avatar.png";
import arrowIcon from "../../assets/survey/detail/detail-arrow.svg";
import audienceIcon from "../../assets/survey/detail/detail-audience.svg";
import backIcon from "../../assets/survey/detail/detail-back.svg";
import emailIcon from "../../assets/survey/detail/detail-email.svg";
import estimateIcon from "../../assets/survey/detail/detail-estimate.svg";
import fallbackHero from "../../assets/survey/detail/detail-hero.jpg";
import helpIcon from "../../assets/survey/detail/detail-help.svg";
import periodIcon from "../../assets/survey/detail/detail-period.svg";
import phoneIcon from "../../assets/survey/detail/detail-phone.svg";
import statusIcon from "../../assets/survey/detail/detail-status.svg";
import { API_BASE_URL } from "../../lib/api";
import "../../styles/survey/SurveyDetail.scss";

const AUTH_TOKEN_KEY = "survey_auth_token";

type SurveyDetailProps = {
  accountDescription?: string;
  accountName?: string;
  isAuthenticated: boolean;
  onAuthAction?: () => void;
  onBackHome?: () => void;
  onOpenManageSurveys?: () => void;
  onOpenProfile?: () => void;
  onOpenSurveyList?: () => void;
  onStartSurvey?: (surveyId: number | string) => void;
  onUnauthorized?: () => void;
  surveyId: number | null;
};

type ApiResult<TData = unknown> = {
  data?: TData;
  message?: string;
  status?: string;
};

type SurveyDetailApi = {
  closes_at?: string | null;
  description?: string | null;
  estimated_time?: number | string | null;
  id?: number | string;
  instructions?: string | null;
  opens_at?: string | null;
  restrictions?: string[] | null;
  status?: string | null;
  thumbnail_path?: string | null;
  title?: string | null;
};

type SurveyDetailView = {
  audience: string;
  closesAt?: string | null;
  description: string;
  estimatedTime?: number | null;
  id: number | string;
  image?: string | null;
  instructions: string[];
  opensAt?: string | null;
  status: string;
  title: string;
};

const STATUS_LABELS: Record<string, string> = {
  open: "OPEN",
  upcoming: "UPCOMING",
};

const POSITION_LABELS: Record<string, string> = {
  asn: "Pegawai ASN",
  non_asn: "Pegawai Non-ASN",
  public: "Penduduk Kota Jogja",
};

const fallbackDetail: SurveyDetailView = {
  audience: "Penduduk Kota Jogja",
  closesAt: "2026-12-31",
  description:
    "Survey ini bertujuan untuk mengumpulkan masukan dan aspirasi masyarakat Kota Yogyakarta terhadap kualitas pelayanan publik. Hasil dari survey ini akan menjadi landasan utama bagi Pemerintah Kota Yogyakarta dalam merumuskan kebijakan transformasi digital dan peningkatan efisiensi layanan publik di masa mendatang.",
  estimatedTime: 10,
  id: "fallback-detail",
  image: fallbackHero,
  instructions: [
    "Pastikan Anda telah masuk menggunakan akun JSS untuk memulai pengisian.",
    "Jawablah setiap pertanyaan dengan sejujur-jujurnya sesuai dengan pengalaman Anda.",
    "Beberapa pertanyaan mungkin memiliki logika kondisional yang akan muncul berdasarkan jawaban sebelumnya.",
    "Anda dapat menyimpan draf progres pengisian dan melanjutkannya di lain waktu.",
    "Tekan tombol Kirim di akhir kuesioner untuk mengirimkan seluruh jawaban Anda.",
  ],
  opensAt: "2026-01-01",
  status: "open",
  title: "Evaluasi Pelayanan Publik 2026",
};

const getStoredToken = () =>
  localStorage.getItem(AUTH_TOKEN_KEY) ?? sessionStorage.getItem(AUTH_TOKEN_KEY);

const authHeaders = (): HeadersInit => {
  const token = getStoredToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const resolveImageUrl = (path?: string | null) => {
  if (!path) {
    return fallbackHero;
  }

  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
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

const formatPeriod = (opensAt?: string | null, closesAt?: string | null) => {
  const start = formatDate(opensAt);
  const end = formatDate(closesAt);

  if (!start && !end) {
    return "Periode belum ditentukan";
  }

  if (!start) {
    return `Sampai ${end}`;
  }

  if (!end) {
    return `Mulai ${start}`;
  }

  return `${start} - ${end}`;
};

const normalizeAudience = (restrictions?: string[] | null) => {
  if (!restrictions || restrictions.length === 0 || restrictions.includes("public")) {
    return "Penduduk Kota Jogja";
  }

  return Array.from(
    new Set(restrictions.map((position) => POSITION_LABELS[position] ?? position)),
  ).join(" & ");
};

const normalizeInstructions = (instructions?: string | null) => {
  const lines = instructions
    ?.split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return lines && lines.length > 0 ? lines : fallbackDetail.instructions;
};

const normalizeSurveyDetail = (detail: SurveyDetailApi): SurveyDetailView => ({
  audience: normalizeAudience(detail.restrictions),
  closesAt: detail.closes_at,
  description: detail.description?.trim() || fallbackDetail.description,
  estimatedTime: normalizeEstimatedTime(detail.estimated_time),
  id: detail.id ?? fallbackDetail.id,
  image: detail.thumbnail_path,
  instructions: normalizeInstructions(detail.instructions),
  opensAt: detail.opens_at,
  status: detail.status?.trim().toLowerCase() || "upcoming",
  title: detail.title?.trim() || fallbackDetail.title,
});

const getStatusLabel = (status: string) => STATUS_LABELS[status] ?? status;

export const SurveyDetail = ({
  accountDescription,
  accountName,
  isAuthenticated,
  onAuthAction,
  onBackHome,
  onOpenManageSurveys,
  onOpenProfile,
  onOpenSurveyList,
  onStartSurvey,
  onUnauthorized,
  surveyId,
}: SurveyDetailProps) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [survey, setSurvey] = useState<SurveyDetailView>(fallbackDetail);
  const [isLoading, setIsLoading] = useState(() => Boolean(surveyId));
  const [feedbackMessage, setFeedbackMessage] = useState("");

  useEffect(() => {
    if (!surveyId) {
      return;
    }

    const controller = new AbortController();

    const fetchSurveyDetail = async () => {
      setIsLoading(true);
      setFeedbackMessage("");

      try {
        const response = await fetch(`${API_BASE_URL}/surveys/${surveyId}`, {
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
          const result = (await response.json().catch(() => ({}))) as ApiResult;
          throw new Error(result.message ?? "Detail survey belum bisa dimuat.");
        }

        const result = (await response.json()) as ApiResult<SurveyDetailApi>;

        if (!result.data) {
          throw new Error("Detail survey tidak ditemukan.");
        }

        setSurvey(normalizeSurveyDetail(result.data));
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setSurvey(fallbackDetail);
        setFeedbackMessage(
          error instanceof Error
            ? error.message
            : "Detail survey belum bisa dimuat.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    void fetchSurveyDetail();

    return () => controller.abort();
  }, [onUnauthorized, surveyId]);

  useEffect(() => {
    if (!feedbackMessage) {
      return;
    }

    const timerId = window.setTimeout(() => {
      setFeedbackMessage("");
    }, 4200);

    return () => window.clearTimeout(timerId);
  }, [feedbackMessage]);

  const isSurveyOpen = survey.status === "open";
  const visibleFeedbackMessage = surveyId
    ? feedbackMessage
    : "Survey tidak ditemukan.";
  const estimatedTime = survey.estimatedTime
    ? `${survey.estimatedTime} Menit`
    : "10 - 15 Menit";

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

  const handleProfileClick = () => {
    closeSidebar();
    onOpenProfile?.();
  };

  const handleAuthAction = () => {
    closeSidebar();
    onAuthAction?.();
  };

  const handleStartSurvey = async () => {
    if (!isSurveyOpen || !surveyId) {
      setFeedbackMessage("Survey ini belum dapat diisi.");
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/surveys/${surveyId}/form`, {
        credentials: "include",
        headers: authHeaders(),
        method: "GET",
      });

      if (response.status === 401) {
        onUnauthorized?.();
        return;
      }

      if (!response.ok) {
        const result = (await response.json().catch(() => ({}))) as ApiResult;
        throw new Error(result.message ?? "Form survey belum bisa dibuka.");
      }

      onStartSurvey?.(surveyId);
    } catch (error) {
      setFeedbackMessage(
        error instanceof Error ? error.message : "Form survey belum bisa dibuka.",
      );
    }
  };

  const contentClassName = useMemo(
    () =>
      [
        "survey-detail-content",
        isLoading ? "is-loading" : "",
      ]
        .filter(Boolean)
        .join(" "),
    [isLoading],
  );

  return (
    <main className="survey-detail-page">
      <Topbar
        avatarSrc={adminAvatar}
        isSidebarOpen={isSidebarOpen}
        onProfileClick={handleProfileClick}
        onToggleSidebar={toggleSidebar}
        sidebarId="survey-detail-sidebar"
        title="Survey Pemkot Jogja"
      />

      <Sidebar
        accountDescription={accountDescription}
        accountName={accountName}
        activeItem="Daftar Survey"
        avatarSrc={adminAvatar}
        id="survey-detail-sidebar"
        isAuthenticated={isAuthenticated}
        isOpen={isSidebarOpen}
        onAuthAction={handleAuthAction}
        onClose={closeSidebar}
        onNavigate={handleNavigationClick}
      />

      <section className="survey-detail-shell">
        {visibleFeedbackMessage && (
          <p className="survey-detail-toast" role="status">
            {visibleFeedbackMessage}
          </p>
        )}

        <div className={contentClassName}>
          <button
            className="survey-detail-back"
            onClick={onOpenSurveyList}
            type="button"
          >
            <img src={backIcon} alt="" aria-hidden="true" />
            Kembali ke Daftar Survey
          </button>

          <section className="survey-detail-hero" aria-label="Gambar survey">
            <img
              alt=""
              onError={(event) => {
                event.currentTarget.src = fallbackHero;
              }}
              src={resolveImageUrl(survey.image)}
            />
          </section>

          <section className="survey-detail-card" aria-labelledby="survey-detail-title">
            <div className="survey-detail-card__intro">
              <span
                className={`survey-detail-status survey-detail-status--${survey.status}`}
              >
                <img
                  className="survey-detail-status__icon"
                  src={statusIcon}
                  alt=""
                  aria-hidden="true"
                />
                {getStatusLabel(survey.status)}
              </span>
              <h1 id="survey-detail-title">{survey.title}</h1>
            </div>

            <section className="survey-detail-section">
              <h2>Deskripsi Survey</h2>
              <p>{survey.description}</p>
            </section>

            <section className="survey-detail-section survey-detail-section--guide">
              <h2>Panduan Pengisian</h2>
              <ul>
                {survey.instructions.map((instruction) => (
                  <li key={instruction}>{instruction}</li>
                ))}
              </ul>
            </section>

            <dl className="survey-detail-meta">
              <div>
                <dt>
                  <img
                    className="survey-detail-meta__icon survey-detail-meta__icon--period"
                    src={periodIcon}
                    alt=""
                    aria-hidden="true"
                  />
                  Periode
                </dt>
                <dd>{formatPeriod(survey.opensAt, survey.closesAt)}</dd>
              </div>
              <div>
                <dt>
                  <img
                    className="survey-detail-meta__icon survey-detail-meta__icon--audience"
                    src={audienceIcon}
                    alt=""
                    aria-hidden="true"
                  />
                  Audiens
                </dt>
                <dd>{survey.audience}</dd>
              </div>
              <div>
                <dt>
                  <img
                    className="survey-detail-meta__icon survey-detail-meta__icon--estimate"
                    src={estimateIcon}
                    alt=""
                    aria-hidden="true"
                  />
                  Estimasi
                </dt>
                <dd>{estimatedTime}</dd>
              </div>
            </dl>

            <div className="survey-detail-action">
              <button
                disabled={!isSurveyOpen}
                onClick={() => void handleStartSurvey()}
                type="button"
              >
                {isSurveyOpen ? "Mulai Isi Survey Sekarang" : "Survey Belum Dibuka"}
                <img
                  className="survey-detail-action__icon"
                  src={arrowIcon}
                  alt=""
                  aria-hidden="true"
                />
              </button>
            </div>
          </section>

          <aside className="survey-detail-help">
            <div>
              <img
                className="survey-detail-help__icon"
                src={helpIcon}
                alt=""
                aria-hidden="true"
              />
              <div>
                <h2>Mengalami Kendala Teknis?</h2>
                <p>Tim dukungan kami siap membantu Anda selama jam kerja (08:00 - 16:00).</p>
              </div>
            </div>

            <div>
              <a href="mailto:support@jogjakota.go.id">
                <img
                  className="survey-detail-contact__icon survey-detail-contact__icon--email"
                  src={emailIcon}
                  alt=""
                  aria-hidden="true"
                />
                support@jogjakota.go.id
              </a>
              <a href="tel:+62274123456">
                <img
                  className="survey-detail-contact__icon survey-detail-contact__icon--phone"
                  src={phoneIcon}
                  alt=""
                  aria-hidden="true"
                />
                (0274) 123456
              </a>
            </div>
          </aside>

          <footer className="survey-detail-footer">
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
