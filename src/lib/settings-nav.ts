import type { NavModule } from "@/lib/navigation";

/** Static settings module — not stored in the DB, injected at runtime for every user. */
export const SETTINGS_MODULE = {
  id: "__settings__",
  code: "settings",
  title: "Settings",
  icon: "settings",
  path: "/settings",
  href: "/settings/profile",
  entries: [
    { kind: "item", id: "__settings_profile__",       code: "settings_profile",       title: "Profile",              icon: "user",              path: "/settings/profile"       },
    { kind: "item", id: "__settings_appearance__",    code: "settings_appearance",    title: "Appearance",           icon: "palette",           path: "/settings/appearance"    },
    { kind: "item", id: "__settings_security__",      code: "settings_security",      title: "Password & Security",  icon: "key-round",         path: "/settings/security"      },
    { kind: "item", id: "__settings_notifications__", code: "settings_notifications", title: "Notifications",        icon: "bell",              path: "/settings/notifications" },
    { kind: "item", id: "__settings_sessions__",      code: "settings_sessions",      title: "Sessions",             icon: "monitor-smartphone", path: "/settings/sessions"      },
  ],
} satisfies NavModule;
