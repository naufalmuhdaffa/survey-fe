import { useState } from "react";
import { Sidebar } from "../../components/sidebar";
import { Topbar } from "../../components/topbar";
import badgeCheckIcon from "../../assets/profile/profile-badge-check.svg";
import breadcrumbChevronIcon from "../../assets/profile/profile-breadcrumb-chevron.svg";
import cameraIcon from "../../assets/profile/profile-camera.svg";
import chevronRightIcon from "../../assets/profile/profile-chevron-right.svg";
import editIcon from "../../assets/profile/profile-edit.svg";
import lockIcon from "../../assets/profile/profile-lock.svg";
import profileAvatar from "../../assets/profile/profile-avatar.jpg";
import "../../styles/profile/Profile.scss";

type ProfileProps = {
  isAuthenticated: boolean;
  onAuthAction?: () => void;
  onBackHome?: () => void;
};

type ProfileField = {
  editable?: boolean;
  label: string;
  value: string;
};

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

export const Profile = ({
  isAuthenticated,
  onAuthAction,
  onBackHome,
}: ProfileProps) => {
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

  const handleAuthAction = () => {
    closeSidebar();
    onAuthAction?.();
  };

  return (
    <main className="profile-page">
      <Topbar
        avatarSrc={profileAvatar}
        isSidebarOpen={isSidebarOpen}
        onProfileClick={closeSidebar}
        onToggleSidebar={toggleSidebar}
        sidebarId="profile-sidebar"
      />

      <Sidebar
        avatarSrc={profileAvatar}
        id="profile-sidebar"
        isAuthenticated={isAuthenticated}
        isOpen={isSidebarOpen}
        onAuthAction={handleAuthAction}
        onClose={closeSidebar}
        onNavigate={handleNavigationClick}
      />

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
