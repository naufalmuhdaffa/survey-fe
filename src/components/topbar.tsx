import "../styles/components/topbar.scss";

type TopbarProps = {
  avatarSrc: string;
  isSidebarOpen: boolean;
  sidebarId: string;
  title?: string;
  onProfileClick?: () => void;
  onToggleSidebar: () => void;
};

export const Topbar = ({
  avatarSrc,
  isSidebarOpen,
  onProfileClick,
  onToggleSidebar,
  sidebarId,
  title = "Survey Pemkot Jogja",
}: TopbarProps) => (
  <header className="app-topbar">
    <button
      aria-controls={sidebarId}
      aria-expanded={isSidebarOpen}
      aria-label={isSidebarOpen ? "Tutup menu" : "Buka menu"}
      className="app-topbar__menu"
      onClick={onToggleSidebar}
      type="button"
    >
      <span />
      <span />
      <span />
    </button>

    <strong>{title}</strong>

    <button
      aria-label="Buka profil"
      className="app-topbar__profile"
      onClick={onProfileClick}
      type="button"
    >
      <img src={avatarSrc} alt="" aria-hidden="true" />
    </button>
  </header>
);
