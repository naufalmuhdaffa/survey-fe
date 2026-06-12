import { useEffect, useMemo, useState } from "react";
import adminAvatar from "../../assets/home/home-admin-avatar.png";
import arrowRightIcon from "../../assets/home/home-arrow-right.svg";
import cardArrowIcon from "../../assets/home/home-card-arrow.svg";
import helpIcon from "../../assets/home/home-help.svg";
import heroImage from "../../assets/home/home-hero.png";
import logoutIcon from "../../assets/home/home-logout.svg";
import accessIcon from "../../assets/home/home-nav-access.svg";
import analyticsIcon from "../../assets/home/home-nav-analytics.svg";
import dashboardIcon from "../../assets/home/home-nav-dashboard.svg";
import historyIcon from "../../assets/home/home-nav-history.svg";
import listIcon from "../../assets/home/home-nav-list.svg";
import manageIcon from "../../assets/home/home-nav-manage.svg";
import usersIcon from "../../assets/home/home-nav-users.svg";
import stepAspirationIcon from "../../assets/home/home-step-aspiration.svg";
import stepLoginIcon from "../../assets/home/home-step-login.svg";
import stepSurveyIcon from "../../assets/home/home-step-survey.svg";
import surveyIllustration from "../../assets/home/home-survey-illustration.png";
import transJogjaBus from "../../assets/home/home-trans-jogja-bus.png";
import "../../styles/home/Home.scss";

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || "http://survey-general-api.test"
).replace(/\/$/, "");

const AUTH_SESSION_KEY = "survey_auth_session";
const AUTH_TOKEN_KEY = "survey_auth_token";

type HomeProps = {
  onLogout?: () => void;
};

type SurveyApiItem = {
  closes_at?: string | null;
  description?: string | null;
  estimated_time?: number | string | null;
  id: number | string;
  opens_at?: string | null;
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
  status?: string | null;
  title: string;
};

type NavigationItem = {
  icon: string;
  label: string;
};

type ParticipationStep = {
  description: string;
  icon: string;
  title: string;
};

const fallbackSurveys: SurveyCard[] = [
  {
    closesAt: "2024-02-15",
    description:
      "Survei mengenai efektivitas dan kenyamanan rute baru bus Trans Jogja di kawasan pusat kota.",
    estimatedTime: 8,
    id: "fallback-trans-jogja",
    image: transJogjaBus,
    opensAt: "2024-01-15",
    status: "open",
    title: "Evaluasi Rute Trans Jogja",
  },
  {
    closesAt: "2024-02-15",
    description:
      "Pendapat masyarakat tentang rencana revitalisasi area pejalan kaki dan ruang hijau di sepanjang Malioboro.",
    estimatedTime: 8,
    id: "fallback-taman-malioboro",
    image: surveyIllustration,
    opensAt: "2024-01-15",
    status: "open",
    title: "Penataan Taman Malioboro",
  },
  {
    closesAt: "2024-02-15",
    description:
      "Penilaian kebutuhan pelatihan dan bantuan modal bagi pelaku Usaha Mikro Kecil Menengah di kota.",
    estimatedTime: 8,
    id: "fallback-umkm",
    image: surveyIllustration,
    opensAt: "2024-01-15",
    status: "open",
    title: "Dukungan UMKM",
  },
];

const navigationItems: NavigationItem[] = [
  { icon: dashboardIcon, label: "Dashboard" },
  { icon: listIcon, label: "Daftar Survey" },
  { icon: manageIcon, label: "Kelola Survey" },
  { icon: usersIcon, label: "User Management" },
  { icon: accessIcon, label: "Pengaturan Hak Akses" },
  { icon: analyticsIcon, label: "Analytics" },
  { icon: historyIcon, label: "History" },
];

const participationSteps: ParticipationStep[] = [
  {
    description: "Masuk menggunakan akun SSO Pemerintah Kota Yogyakarta Anda.",
    icon: stepLoginIcon,
    title: "1. Login Akun",
  },
  {
    description: "Pilih topik survei yang ingin Anda berikan masukan.",
    icon: stepSurveyIcon,
    title: "2. Pilih Survey",
  },
  {
    description: "Isi pertanyaan dengan jujur untuk masa depan Jogja yang lebih baik.",
    icon: stepAspirationIcon,
    title: "3. Berikan Aspirasi",
  },
];

const extractSurveys = (result: SurveyApiResult) => {
  if (Array.isArray(result.data)) {
    return result.data;
  }

  if (Array.isArray(result.data?.surveys)) {
    return result.data.surveys;
  }

  if (Array.isArray(result.data?.items)) {
    return result.data.items;
  }

  return [];
};

const resolveImageUrl = (path?: string | null) => {
  if (!path) {
    return surveyIllustration;
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

const normalizeSurvey = (survey: SurveyApiItem): SurveyCard => ({
  closesAt: survey.closes_at,
  description:
    survey.description?.trim() ||
    "Survei aktif Pemerintah Kota Yogyakarta yang membutuhkan partisipasi Anda.",
  estimatedTime: normalizeEstimatedTime(survey.estimated_time),
  id: survey.id,
  image: survey.thumbnail_path ?? survey.thumbnail,
  opensAt: survey.opens_at,
  status: survey.status,
  title: survey.title?.trim() || "Survey Pemerintah Kota Yogyakarta",
});

const getStatusLabel = (status?: string | null) =>
  status?.toLowerCase() === "open" ? "Open" : "Open";

const getEstimatedTimeLabel = (estimatedTime?: number | null) =>
  `${estimatedTime ?? 8} Menit`;

const formatShortDate = (dateValue?: string | null) => {
  if (!dateValue) {
    return null;
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "Mei",
    "Jun",
    "Jul",
    "Agu",
    "Sep",
    "Okt",
    "Nov",
    "Des",
  ];

  return {
    day: date.getDate(),
    month: monthNames[date.getMonth()],
    year: date.getFullYear(),
  };
};

const getPeriodLabel = (opensAt?: string | null, closesAt?: string | null) => {
  const start = formatShortDate(opensAt);
  const end = formatShortDate(closesAt);

  if (!start || !end) {
    return "15 Jan - 15 Feb 2024";
  }

  if (start.year === end.year) {
    return `${start.day} ${start.month} - ${end.day} ${end.month} ${end.year}`;
  }

  return `${start.day} ${start.month} ${start.year} - ${end.day} ${end.month} ${end.year}`;
};

const getStoredToken = () =>
  localStorage.getItem(AUTH_TOKEN_KEY) ?? sessionStorage.getItem(AUTH_TOKEN_KEY);

const clearAuthSession = () => {
  localStorage.removeItem(AUTH_SESSION_KEY);
  localStorage.removeItem(AUTH_TOKEN_KEY);
  sessionStorage.removeItem(AUTH_SESSION_KEY);
  sessionStorage.removeItem(AUTH_TOKEN_KEY);
};

export const Home = ({ onLogout }: HomeProps) => {
  const [surveys, setSurveys] = useState<SurveyCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    const fetchSurveys = async () => {
      setIsLoading(true);

      try {
        const token = getStoredToken();

        const response = await fetch(`${API_BASE_URL}/surveys`, {
          credentials: "include",
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          method: "GET",
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Daftar survei belum bisa dimuat.");
        }

        const result = (await response.json()) as SurveyApiResult;
        setSurveys(extractSurveys(result).map(normalizeSurvey));
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setSurveys([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSurveys();

    return () => controller.abort();
  }, []);

  const visibleSurveys = useMemo(
    () => (surveys.length > 0 ? surveys : fallbackSurveys),
    [surveys],
  );

  const closeSidebar = () => {
    setIsSidebarOpen(false);
  };

  const toggleSidebar = () => {
    setIsSidebarOpen((current) => !current);
  };

  const handleLogout = async () => {
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        credentials: "include",
        method: "POST",
      });
    } finally {
      clearAuthSession();
      closeSidebar();
      onLogout?.();
    }
  };

  const handleLogoutClick = () => {
    void handleLogout();
  };

  return (
    <main className="home-page">
      <header className="home-topbar">
        <button
          aria-controls="home-sidebar"
          aria-expanded={isSidebarOpen}
          aria-label={isSidebarOpen ? "Tutup menu" : "Buka menu"}
          className="home-topbar__menu"
          onClick={toggleSidebar}
          type="button"
        >
          <span />
          <span />
          <span />
        </button>
        <strong>Survey Pemkot Jogja</strong>
        <button
          aria-label="Logout"
          className="home-topbar__profile"
          onClick={handleLogoutClick}
          type="button"
        >
          <img src={adminAvatar} alt="" aria-hidden="true" />
        </button>
      </header>

      <button
        aria-hidden={!isSidebarOpen}
        className={`home-sidebar-backdrop ${isSidebarOpen ? "is-visible" : ""}`}
        onClick={closeSidebar}
        tabIndex={isSidebarOpen ? 0 : -1}
        type="button"
      />

      <aside
        aria-label="Navigasi utama"
        className={`home-sidebar ${isSidebarOpen ? "is-open" : ""}`}
        id="home-sidebar"
      >
        <div>
          <div className="home-sidebar__profile">
            <img src={adminAvatar} alt="" aria-hidden="true" />
            <div>
              <strong>Admin Portal</strong>
              <small>Survey Jogja Official</small>
            </div>
          </div>

          <nav className="home-navigation" aria-label="Menu dashboard">
            {navigationItems.map((item) => (
              <button
                className={item.label === "Dashboard" ? "is-active" : ""}
                key={item.label}
                onClick={closeSidebar}
                type="button"
              >
                <img src={item.icon} alt="" aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="home-sidebar__footer">
          <button type="button">
            <img src={helpIcon} alt="" aria-hidden="true" />
            <span>Help Center</span>
          </button>
          <button onClick={handleLogoutClick} type="button">
            <img src={logoutIcon} alt="" aria-hidden="true" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      <section className="home-shell">
        <div className="home-content">
          <section className="home-hero" aria-labelledby="home-hero-title">
            <img src={heroImage} alt="" aria-hidden="true" />
            <div className="home-hero__overlay" />
            <div className="home-hero__copy">
              <h1 id="home-hero-title">Suara Anda, Masa Depan Jogja</h1>
              <p>
                Sampaikan aspirasi Anda untuk pembangunan Kota Yogyakarta yang
                lebih inklusif dan berkelanjutan.
              </p>
            </div>
          </section>

          <section className="home-surveys" aria-labelledby="active-surveys">
            <div className="home-section-heading">
              <div>
                <h2 id="active-surveys">Survei Aktif</h2>
                <p>
                  Daftar survei yang sedang berjalan dan membutuhkan partisipasi
                  Anda.
                </p>
              </div>
              <button type="button">
                <span>Lihat Semua</span>
                <img src={arrowRightIcon} alt="" aria-hidden="true" />
              </button>
            </div>

            <div className="home-survey-grid" aria-busy={isLoading}>
              {visibleSurveys.slice(0, 3).map((survey) => (
                <article className="home-survey-card" key={survey.id}>
                  <img
                    alt=""
                    className="home-survey-card__image"
                    onError={(event) => {
                      event.currentTarget.src = surveyIllustration;
                    }}
                    src={resolveImageUrl(survey.image)}
                  />

                  <span className="home-survey-card__badge">
                    {getStatusLabel(survey.status)}
                  </span>

                  <h3>{survey.title}</h3>
                  <p>{survey.description}</p>

                  <dl>
                    <div>
                      <dt>Estimasi:</dt>
                      <dd>{getEstimatedTimeLabel(survey.estimatedTime)}</dd>
                    </div>
                    <div>
                      <dt>Periode:</dt>
                      <dd>{getPeriodLabel(survey.opensAt, survey.closesAt)}</dd>
                    </div>
                  </dl>

                  <button type="button">
                    <span>Isi Survey</span>
                    <img src={cardArrowIcon} alt="" aria-hidden="true" />
                  </button>
                </article>
              ))}
            </div>
          </section>

          <section className="home-steps" aria-labelledby="participation-title">
            <h2 id="participation-title">Cara Berpartisipasi</h2>

            <div className="home-step-grid">
              {participationSteps.map((step) => (
                <article className="home-step" key={step.title}>
                  <span aria-hidden="true">
                    <img src={step.icon} alt="" />
                  </span>
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                </article>
              ))}
            </div>
          </section>

          <footer className="home-footer">
            <div className="home-footer__grid">
              <section>
                <h3>Survey Jogja</h3>
                <p>
                  Platform resmi aspirasi warga untuk pembangunan Kota Yogyakarta
                  yang partisipatif dan transparan.
                </p>
              </section>

              <section>
                <h3>Tautan Cepat</h3>
                <ul>
                  <li>Daftar Survey</li>
                  <li>Tentang Kami</li>
                  <li>Bantuan & FAQ</li>
                </ul>
              </section>

              <section>
                <h3>Hubungi Kami</h3>
                <p>
                  Dinas Komunikasi Informatika & Persandian Kota Yogyakarta
                </p>
                <p>Email: dinkominfosandi@jogjakota.go.id</p>
              </section>
            </div>

            <div className="home-footer__bottom">
              <p>&copy; 2026 Pemerintah Kota Yogyakarta. Hak Cipta Dilindungi.</p>
              <div>
                <span>Kebijakan Privasi</span>
                <span>Syarat & Ketentuan</span>
                <span>Peta Situs</span>
              </div>
            </div>
          </footer>
        </div>
      </section>
    </main>
  );
};
