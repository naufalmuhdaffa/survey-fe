import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
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

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || "http://survey-general-api.test"
).replace(/\/$/, "");

const AUTH_TOKEN_KEY = "survey_auth_token";

type ProfileProps = {
  isAuthenticated: boolean;
  onAuthAction?: () => void;
  onBackHome?: () => void;
  onOpenChangePassword?: () => void;
  onUnauthorized?: () => void;
};

type ProfileData = {
  address: string | null;
  email: string | null;
  full_name: string;
  id: number;
  is_active: boolean;
  nik: string;
  phone: string | null;
  position: "asn" | "non_asn" | "public" | string;
  role: string;
  role_id: number;
  username: string;
};

type ApiResult<T> = {
  data?: T;
  message?: string;
};

type EditableProfileField = "email" | "phone";

type ProfileField = {
  editable?: EditableProfileField;
  key: string;
  label: string;
  value: string;
};

const POSITION_LABELS: Record<string, string> = {
  asn: "Pegawai ASN",
  non_asn: "Pegawai Non-ASN",
  public: "Warga",
};

const ROLE_LABELS: Record<string, string> = {
  admin_opd: "Admin OPD",
  superadmin: "SuperAdmin",
  user: "User",
};

const getStoredToken = () =>
  localStorage.getItem(AUTH_TOKEN_KEY) ?? sessionStorage.getItem(AUTH_TOKEN_KEY);

const authHeaders = (withJson = false): HeadersInit => {
  const token = getStoredToken();
  const headers: Record<string, string> = {};

  if (withJson) {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
};

const getApiMessage = async (response: Response) => {
  try {
    const result = (await response.json()) as ApiResult<unknown>;
    return result.message ?? "Terjadi kesalahan pada server.";
  } catch {
    return "Terjadi kesalahan pada server.";
  }
};

const displayValue = (value: string | null | undefined) => {
  const trimmedValue = typeof value === "string" ? value.trim() : "";
  return trimmedValue || "-";
};

const formatRole = (role: string) => {
  if (ROLE_LABELS[role]) {
    return ROLE_LABELS[role];
  }

  return role
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const formatPosition = (position: string) =>
  POSITION_LABELS[position] ?? "Warga";

const validateEditableField = (
  field: EditableProfileField,
  value: string,
) => {
  const trimmedValue = value.trim();

  if (trimmedValue === "") {
    return null;
  }

  if (field === "email") {
    if (trimmedValue.length > 255) {
      return "Email maksimal 255 karakter.";
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedValue)) {
      return "Format email tidak valid.";
    }

    return null;
  }

  const normalizedPhone = trimmedValue.replace(/[\s().-]/g, "");

  if (!/^\+?[0-9]+$/.test(normalizedPhone)) {
    return "Format nomor telepon tidak valid.";
  }

  const isIndonesianPhone =
    normalizedPhone.startsWith("+62") ||
    normalizedPhone.startsWith("62") ||
    normalizedPhone.startsWith("08");

  if (!isIndonesianPhone) {
    return "Nomor telepon harus diawali +62, 62, atau 08.";
  }

  const comparablePhone = normalizedPhone.startsWith("08")
    ? `+62${normalizedPhone.slice(1)}`
    : normalizedPhone.startsWith("62")
      ? `+${normalizedPhone}`
      : normalizedPhone;

  if (!/^\+62[0-9]{8,13}$/.test(comparablePhone)) {
    return "Format nomor telepon tidak valid.";
  }

  return null;
};

export const Profile = ({
  isAuthenticated,
  onAuthAction,
  onBackHome,
  onOpenChangePassword,
  onUnauthorized,
}: ProfileProps) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [feedback, setFeedback] = useState<{
    message: string;
    type: "error" | "success";
  } | null>(null);
  const [editingField, setEditingField] =
    useState<EditableProfileField | null>(null);
  const [drafts, setDrafts] = useState<Record<EditableProfileField, string>>({
    email: "",
    phone: "",
  });
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<EditableProfileField, string>>
  >({});
  const [savingField, setSavingField] = useState<EditableProfileField | null>(
    null,
  );

  const loadProfile = useCallback(async () => {
    if (!isAuthenticated) {
      setProfile(null);
      setIsLoadingProfile(false);
      return;
    }

    setIsLoadingProfile(true);
    setFeedback(null);

    try {
      const response = await fetch(`${API_BASE_URL}/users/profile`, {
        credentials: "include",
        headers: authHeaders(),
        method: "GET",
      });

      if (response.status === 401) {
        onUnauthorized?.();
        return;
      }

      if (!response.ok) {
        throw new Error(await getApiMessage(response));
      }

      const result = (await response.json()) as ApiResult<ProfileData>;

      if (!result.data) {
        throw new Error("Data profil tidak ditemukan.");
      }

      setProfile(result.data);
      setDrafts({
        email: result.data.email ?? "",
        phone: result.data.phone ?? "",
      });
    } catch (error) {
      setFeedback({
        message:
          error instanceof Error
            ? error.message
            : "Profil gagal dimuat. Silakan coba lagi.",
        type: "error",
      });
    } finally {
      setIsLoadingProfile(false);
    }
  }, [isAuthenticated, onUnauthorized]);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void loadProfile();
    }, 0);

    return () => window.clearTimeout(timerId);
  }, [loadProfile]);

  const profileFields = useMemo<ProfileField[]>(
    () => [
      {
        key: "full_name",
        label: "Nama Lengkap",
        value: displayValue(profile?.full_name),
      },
      {
        key: "nik",
        label: "NIK",
        value: displayValue(profile?.nik),
      },
      {
        editable: "email",
        key: "email",
        label: "Alamat Email",
        value: displayValue(profile?.email),
      },
      {
        editable: "phone",
        key: "phone",
        label: "Nomor Telepon",
        value: displayValue(profile?.phone),
      },
      {
        key: "address",
        label: "Alamat Lengkap",
        value: displayValue(profile?.address),
      },
    ],
    [profile],
  );

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

  const handleStartEdit = (field: EditableProfileField) => {
    setFeedback(null);
    setEditingField(field);
    setDrafts((current) => ({
      ...current,
      [field]: profile?.[field] ?? "",
    }));
    setFieldErrors((current) => ({
      ...current,
      [field]: undefined,
    }));
  };

  const handleCancelEdit = () => {
    setEditingField(null);
    setFieldErrors({});
    setDrafts({
      email: profile?.email ?? "",
      phone: profile?.phone ?? "",
    });
  };

  const handleDraftChange = (field: EditableProfileField, value: string) => {
    setDrafts((current) => ({
      ...current,
      [field]: value,
    }));
    setFeedback(null);
    setFieldErrors((current) => ({
      ...current,
      [field]: validateEditableField(field, value) ?? undefined,
    }));
  };

  const handleSaveField = async (
    event: FormEvent<HTMLFormElement>,
    field: EditableProfileField,
  ) => {
    event.preventDefault();

    const error = validateEditableField(field, drafts[field]);

    if (error) {
      setFieldErrors((current) => ({
        ...current,
        [field]: error,
      }));
      return;
    }

    setSavingField(field);
    setFeedback(null);

    try {
      const response = await fetch(`${API_BASE_URL}/users/profile`, {
        body: JSON.stringify({
          [field]: drafts[field].trim(),
        }),
        credentials: "include",
        headers: authHeaders(true),
        method: "PATCH",
      });

      if (response.status === 401) {
        onUnauthorized?.();
        return;
      }

      if (!response.ok) {
        throw new Error(await getApiMessage(response));
      }

      const result = (await response.json()) as ApiResult<ProfileData>;

      if (result.data) {
        setProfile(result.data);
        setDrafts({
          email: result.data.email ?? "",
          phone: result.data.phone ?? "",
        });
      }

      setEditingField(null);
      setFieldErrors({});
      setFeedback({
        message: result.message ?? "Profil berhasil diperbarui.",
        type: "success",
      });
    } catch (error) {
      setFeedback({
        message:
          error instanceof Error
            ? error.message
            : "Profil gagal diperbarui. Silakan coba lagi.",
        type: "error",
      });
    } finally {
      setSavingField(null);
    }
  };

  const handleOpenChangePassword = () => {
    closeSidebar();
    onOpenChangePassword?.();
  };

  const identityName = displayValue(profile?.full_name);
  const positionLabel = formatPosition(profile?.position ?? "");
  const roleLabel = formatRole(profile?.role ?? "user");

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

            {feedback && (
              <p className={`profile-feedback profile-feedback--${feedback.type}`}>
                {feedback.message}
              </p>
            )}

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
                  <h2>{isLoadingProfile ? "Memuat profil..." : identityName}</h2>
                  <div className="profile-badges" aria-label="Status akun">
                    <span className="profile-badge profile-badge--citizen">
                      <img src={badgeCheckIcon} alt="" aria-hidden="true" />
                      {positionLabel}
                    </span>
                    <span className="profile-badge profile-badge--role">
                      {roleLabel}
                    </span>
                  </div>
                </div>
              </div>
            </section>

            <section className="profile-card profile-info">
              <header>
                <h2>Informasi Pribadi</h2>
              </header>

              {isLoadingProfile ? (
                <p className="profile-empty-state">Memuat data profil...</p>
              ) : (
                <div className="profile-info__grid">
                  {profileFields.map((field) => (
                    <div className="profile-field" key={field.key}>
                      <span>{field.label}</span>
                      {field.editable !== undefined &&
                      editingField === field.editable ? (
                        <form
                          className="profile-field__editor"
                          onSubmit={(event) =>
                            handleSaveField(event, field.editable!)
                          }
                        >
                          <input
                            aria-label={field.label}
                            autoComplete={
                              field.editable === "email" ? "email" : "tel"
                            }
                            inputMode={
                              field.editable === "email" ? "email" : "tel"
                            }
                            onChange={(event) =>
                              handleDraftChange(field.editable!, event.target.value)
                            }
                            type={field.editable === "email" ? "email" : "tel"}
                            value={drafts[field.editable]}
                          />
                          <div className="profile-field__actions">
                            <button
                              disabled={savingField === field.editable}
                              type="submit"
                            >
                              {savingField === field.editable
                                ? "Menyimpan..."
                                : "Simpan"}
                            </button>
                            <button
                              disabled={savingField === field.editable}
                              onClick={handleCancelEdit}
                              type="button"
                            >
                              Batal
                            </button>
                          </div>
                          {fieldErrors[field.editable] && (
                            <p className="profile-field__error">
                              {fieldErrors[field.editable]}
                            </p>
                          )}
                        </form>
                      ) : (
                        <div className="profile-field__value">
                          <p>{field.value}</p>
                          {field.editable && (
                            <button
                              aria-label={`Ubah ${field.label}`}
                              onClick={() => handleStartEdit(field.editable!)}
                              type="button"
                            >
                              <img src={editIcon} alt="" aria-hidden="true" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="profile-card profile-security">
              <h2>Keamanan Akun</h2>
              <button
                className="profile-security__row"
                onClick={handleOpenChangePassword}
                type="button"
              >
                <span className="profile-security__icon" aria-hidden="true">
                  <img src={lockIcon} alt="" />
                </span>
                <span className="profile-security__copy">
                  <strong>Ubah Password</strong>
                  <small>Gunakan password lama untuk membuat password baru</small>
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
