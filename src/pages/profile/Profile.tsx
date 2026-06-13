import { useState } from "react";
import helpIcon from "../../assets/home/home-help.svg";
import logoutIcon from "../../assets/home/home-logout.svg";
import accessIcon from "../../assets/home/home-nav-access.svg";
import analyticsIcon from "../../assets/home/home-nav-analytics.svg";
import dashboardIcon from "../../assets/home/home-nav-dashboard.svg";
import historyIcon from "../../assets/home/home-nav-history.svg";
import listIcon from "../../assets/home/home-nav-list.svg";
import manageIcon from "../../assets/home/home-nav-manage.svg";
import usersIcon from "../../assets/home/home-nav-users.svg";
import badgeCheckIcon from "../../assets/profile/profile-badge-check.svg";
import breadcrumbChevronIcon from "../../assets/profile/profile-breadcrumb-chevron.svg";
import cameraIcon from "../../assets/profile/profile-camera.svg";
import chevronRightIcon from "../../assets/profile/profile-chevron-right.svg";
import editIcon from "../../assets/profile/profile-edit.svg";
import lockIcon from "../../assets/profile/profile-lock.svg";
import profileAvatar from "../../assets/profile/profile-avatar.jpg";
import "../../styles/profile/Profile.scss";

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || "http://survey-general-api.test"
).replace(/\/$/, "");

const AUTH_SESSION_KEY = "survey_auth_session";
const AUTH_TOKEN_KEY = "survey_auth_token";

type ProfileProps = {
  onBackHome?: () => void;
  onLogout?: () => void;
};

type NavigationItem = {
  icon: string;
  label: string;
};

type ProfileField = {
  editable?: boolean;
  label: string;
  value: string;
};

const navigationItems: NavigationItem[] = [
  { icon: dashboardIcon, label: "Dashboard" },
  { icon: listIcon, label: "Daftar Survey" },
  { icon: manageIcon, label: "Kelola Survey" },
  { icon: usersIcon, label: "User Management" },
  { icon: accessIcon, label: "Pengaturan Hak Akses" },
  { icon: analyticsIcon, label: "Analytics" },
  { icon: historyIcon, label: "History" },
];

const profileFields: ProfileField[] = [
  { label: "Nama Lengkap", value: "Budi Santoso" },
  { label: "NIK", value: "198503242010121002" },
  {
    editable: true,
    label: "Alamat Email",
    value: "budi.santoso@jogjaprov.go.id",
  },
  {
    editable: true,
    label: "Nomor Telepon",
    value: "0812-3456-7890",
  },
  {
    editable: true,
    label: "Alamat Lengkap",
    value:
      "Jl. Kaliurang KM 7, RT 05/RW 03, Kelurahan Caturtunggal, Kecamatan Depok, Kabupaten Sleman, Daerah Istimewa Yogyakarta, 5528",
  },
];

const clearAuthSession = () => {
  localStorage.removeItem(AUTH_SESSION_KEY);
  localStorage.removeItem(AUTH_TOKEN_KEY);
  sessionStorage.removeItem(AUTH_SESSION_KEY);
  sessionStorage.removeItem(AUTH_TOKEN_KEY);
};

export const Profile = ({ onBackHome, onLogout }: ProfileProps) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const closeSidebar = () => {
    setIsSidebarOpen(false);
  };

  const toggleSidebar = () => {
    setIsSidebarOpen((current) => !current);
  };

  const handleBackHome = () => {
    closeSidebar();
    onBackHome?.();
  };

  const handleNavigationClick = (label: string) => {
    closeSidebar();

    if (label === "Dashboard") {
      onBackHome?.();
    }
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
    <main className="profile-page">
      <header className="profile-topbar">
        <button
          aria-controls="profile-sidebar"
          aria-expanded={isSidebarOpen}
          aria-label={isSidebarOpen ? "Tutup menu" : "Buka menu"}
          className="profile-topbar__menu"
          onClick={toggleSidebar}
          type="button"
        >
          <span />
          <span />
          <span />
        </button>
        <strong>Survey PemKot Jogja</strong>
        <div className="profile-topbar__avatar" aria-hidden="true">
          <img src={profileAvatar} alt="" aria-hidden="true" />
        </div>
      </header>

      <button
        aria-hidden={!isSidebarOpen}
        className={`profile-sidebar-backdrop ${
          isSidebarOpen ? "is-visible" : ""
        }`}
        onClick={closeSidebar}
        tabIndex={isSidebarOpen ? 0 : -1}
        type="button"
      />

      <aside
        aria-label="Navigasi utama"
        className={`profile-sidebar ${isSidebarOpen ? "is-open" : ""}`}
        id="profile-sidebar"
      >
        <div>
          <div className="profile-sidebar__account">
            <img src={profileAvatar} alt="" aria-hidden="true" />
            <div>
              <strong>Admin Portal</strong>
              <small>Survey Jogja Official</small>
            </div>
          </div>

          <nav className="profile-navigation" aria-label="Menu dashboard">
            {navigationItems.map((item) => (
              <button
                key={item.label}
                onClick={() => handleNavigationClick(item.label)}
                type="button"
              >
                <img src={item.icon} alt="" aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="profile-sidebar__footer">
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

      <section className="profile-shell">
        <div className="profile-content">
          <div className="profile-main-stack">
            <header className="profile-heading">
              <div>
                <h1>User Profile</h1>
                <p>
                  Manage your personal information, privacy settings, and account
                  security.
                </p>
              </div>

              <nav className="profile-breadcrumb" aria-label="Breadcrumb">
                <button onClick={handleBackHome} type="button">
                  Home
                </button>
                <img src={breadcrumbChevronIcon} alt="" aria-hidden="true" />
                <span>Pengaturan Profil</span>
              </nav>
            </header>

            <section className="profile-card profile-overview">
              <div className="profile-overview__inner">
                <div className="profile-overview__avatar-wrap">
                  <img
                    className="profile-overview__avatar"
                    src={profileAvatar}
                    alt=""
                    aria-hidden="true"
                  />
                  <button
                    aria-label="Ubah foto profil"
                    className="profile-overview__camera"
                    type="button"
                  >
                    <img src={cameraIcon} alt="" aria-hidden="true" />
                  </button>
                </div>

                <div className="profile-overview__identity">
                  <h2>Budi Santoso</h2>
                  <p>budi.santoso@email.com</p>
                  <div className="profile-badges" aria-label="Status akun">
                    <span className="profile-badge profile-badge--citizen">
                      <img src={badgeCheckIcon} alt="" aria-hidden="true" />
                      Warga
                    </span>
                    <span className="profile-badge profile-badge--role">
                      SuperAdmin
                    </span>
                  </div>
                </div>
              </div>
            </section>

            <section className="profile-card profile-info">
              <header>
                <h2>Informasi Pribadi</h2>
              </header>

              <div className="profile-info__grid">
                {profileFields.map((field) => (
                  <div className="profile-field" key={field.label}>
                    <span>{field.label}</span>
                    <div className="profile-field__value">
                      <p>{field.value}</p>
                      {field.editable && (
                        <button
                          aria-label={`Ubah ${field.label}`}
                          type="button"
                        >
                          <img src={editIcon} alt="" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="profile-card profile-security">
              <h2>Keamanan Akun</h2>
              <button className="profile-security__row" type="button">
                <span className="profile-security__icon" aria-hidden="true">
                  <img src={lockIcon} alt="" />
                </span>
                <span className="profile-security__copy">
                  <strong>Ubah Password</strong>
                  <small>Terakhir diubah 3 bulan lalu</small>
                </span>
                <img
                  className="profile-security__chevron"
                  src={chevronRightIcon}
                  alt=""
                  aria-hidden="true"
                />
              </button>
            </section>
          </div>

          <footer className="profile-footer">
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
