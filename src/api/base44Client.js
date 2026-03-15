/**
 * Drop-in replacement for @base44/sdk
 * Implements the same interface: base44.entities.Entity.operation()
 * but calls the local Express backend at /api/entities and /api/functions
 */

const API_BASE = '/api';

/* ─── Credentials modal ──────────────────────────────────────────────────── */

function copyToClipboard(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    const orig = btn.textContent;
    btn.textContent = '✅ Copié !';
    btn.style.background = '#16a34a';
    setTimeout(() => { btn.textContent = orig; btn.style.background = '#2563eb'; }, 1800);
  });
}

function printCredentials(login, password, fullName, typeLabel, notifyEmail) {
  const w = window.open('', '_blank', 'width=500,height=400');
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
  <title>Accès EduGest — ${fullName}</title>
  <style>
    body{font-family:Arial,sans-serif;padding:32px;color:#0f172a;}
    .header{text-align:center;border-bottom:2px solid #2563eb;padding-bottom:16px;margin-bottom:24px;}
    .label{font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;}
    .value{font-family:monospace;font-size:22px;font-weight:800;color:#2563eb;letter-spacing:3px;margin-bottom:16px;}
    .note{font-size:12px;color:#94a3b8;margin-top:24px;border-top:1px solid #e2e8f0;padding-top:12px;}
    @media print{button{display:none!important;}}
  </style>
  </head><body>
  <div class="header"><h2 style="margin:0;color:#2563eb;">EduGest — Fiche d'accès</h2><p style="margin:4px 0;font-size:13px;color:#64748b;">${typeLabel} : ${fullName}</p></div>
  <div class="label">Identifiant de connexion</div>
  <div class="value">${login}</div>
  <div class="label">Mot de passe provisoire</div>
  <div class="value">${password}</div>
  ${notifyEmail ? `<p style="font-size:13px;color:#64748b;">📧 À remettre à : <strong>${notifyEmail}</strong></p>` : ''}
  <div class="note">⚠️ Ce mot de passe est provisoire. Il devra être modifié à la première connexion.<br>Adresse de connexion : <strong>http://localhost:5173/AppLogin</strong></div>
  <br><button onclick="window.print()" style="padding:8px 20px;background:#2563eb;color:white;border:none;border-radius:6px;cursor:pointer;font-size:14px;">🖨️ Imprimer</button>
  </body></html>`);
  w.document.close();
  setTimeout(() => w.print(), 300);
}

/**
 * Display a modal with auto-generated account credentials.
 * Called after creating a Student, Teacher or Staff profile.
 */
function showAccountCreatedNotification(account, entityType) {
  const labels = { Student: 'Élève', Teacher: 'Enseignant', Staff: 'Personnel' };
  const typeLabel = labels[entityType] || entityType;

  const emailInfo = account.notify_email
    ? `<p style="margin:6px 0 0;font-size:12px;color:#64748b;">📧 À communiquer à : <strong>${account.notify_email}</strong></p>`
    : `<p style="margin:6px 0 0;font-size:12px;color:#ef4444;">⚠️ Aucun email renseigné — communiquer manuellement.</p>`;

  const modal = document.createElement('div');
  modal.id = 'edugest-cred-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:99999;display:flex;align-items:center;justify-content:center;';

  modal.innerHTML = `
    <div style="background:white;border-radius:16px;padding:28px;max-width:440px;width:92%;box-shadow:0 25px 60px rgba(0,0,0,0.35);">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:18px;">
        <div style="width:42px;height:42px;background:#dcfce7;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;">✅</div>
        <div>
          <h3 style="margin:0;font-size:16px;font-weight:700;color:#0f172a;">Compte créé automatiquement</h3>
          <p style="margin:0;font-size:12px;color:#64748b;">Profil ${typeLabel}</p>
        </div>
      </div>

      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px;margin-bottom:12px;">

        <div style="margin-bottom:12px;">
          <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.5px;">Identifiant de connexion</p>
          <div style="display:flex;align-items:center;gap:8px;">
            <p id="cred-login" style="margin:0;font-size:18px;font-weight:700;color:#0f172a;font-family:monospace;flex:1;">${account.login}</p>
            <button id="btn-copy-login"
              style="padding:4px 10px;background:#2563eb;color:white;border:none;border-radius:6px;font-size:12px;cursor:pointer;white-space:nowrap;">
              📋 Copier
            </button>
          </div>
        </div>

        <div>
          <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.5px;">Mot de passe provisoire</p>
          <div style="display:flex;align-items:center;gap:8px;">
            <p id="cred-pwd" style="margin:0;font-size:26px;font-weight:800;color:#2563eb;font-family:monospace;letter-spacing:4px;flex:1;">${account.provisional_password}</p>
            <button id="btn-copy-pwd"
              style="padding:4px 10px;background:#2563eb;color:white;border:none;border-radius:6px;font-size:12px;cursor:pointer;white-space:nowrap;">
              📋 Copier
            </button>
          </div>
        </div>
      </div>

      ${emailInfo}
      <p style="margin:8px 0 14px;font-size:12px;color:#94a3b8;">Le mot de passe devra être changé à la première connexion.</p>

      <div style="display:flex;gap:8px;">
        <button id="btn-print-cred"
          style="flex:1;padding:9px;background:#f1f5f9;color:#334155;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">
          🖨️ Imprimer la fiche
        </button>
        <button id="btn-close-cred"
          style="flex:1;padding:9px;background:#2563eb;color:white;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">
          Fermer
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Wire up buttons after appending
  modal.querySelector('#btn-copy-login').addEventListener('click', function() {
    copyToClipboard(account.login, this);
  });
  modal.querySelector('#btn-copy-pwd').addEventListener('click', function() {
    copyToClipboard(account.provisional_password, this);
  });
  modal.querySelector('#btn-print-cred').addEventListener('click', () => {
    printCredentials(account.login, account.provisional_password, account.full_name || '', typeLabel, account.notify_email);
  });
  modal.querySelector('#btn-close-cred').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
}

/* ─── HTTP helpers ───────────────────────────────────────────────────────── */

async function request(method, path, body) {
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body !== undefined) options.body = JSON.stringify(body);

  const res = await fetch(`${API_BASE}${path}`, options);
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { const d = await res.json(); msg = d.error || msg; } catch {}
    throw new Error(msg);
  }
  return res.json();
}

function buildFilterParams(conditions) {
  if (!conditions || Object.keys(conditions).length === 0) return '';
  return `?filters=${encodeURIComponent(JSON.stringify(conditions))}`;
}

/* ─── Entities proxy ─────────────────────────────────────────────────────── */

function createEntityProxy(entityName) {
  return {
    list: () => request('GET', `/entities/${entityName}`),
    filter: (conditions) => request('GET', `/entities/${entityName}${buildFilterParams(conditions)}`),
    get: (id) => request('GET', `/entities/${entityName}/${id}`),

    create: async (data) => {
      const result = await request('POST', `/entities/${entityName}`, data);
      if (result._account) {
        showAccountCreatedNotification(result._account, entityName);
      }
      return result;
    },

    update: (id, data) => request('PUT', `/entities/${entityName}/${id}`, data),
    delete: (id) => request('DELETE', `/entities/${entityName}/${id}`),
    bulkCreate: (items) => request('POST', `/entities/${entityName}/bulk`, items),
  };
}

const entitiesProxy = new Proxy({}, {
  get(_, entityName) {
    return createEntityProxy(String(entityName));
  },
});

/* ─── Functions proxy ────────────────────────────────────────────────────── */

const functionsProxy = new Proxy({}, {
  get(_, fnName) {
    // Support both:
    //   base44.functions.appLogin({ login, pin_hash })
    //   base44.functions.invoke('appUserAdmin', { action: 'list' })
    if (fnName === 'invoke') {
      return (name, payload) => request('POST', `/functions/${String(name)}`, payload);
    }
    return (payload) => request('POST', `/functions/${String(fnName)}`, payload);
  },
});

/* ─── Integrations stubs ─────────────────────────────────────────────────── */

const integrations = {
  Core: {
    UploadFile: async (file) => {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${API_BASE}/upload`, { method: 'POST', body: formData });
      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();
      return { file_url: data.file_url };
    },
    InvokeLLM: async () => {
      console.warn('[InvokeLLM] LLM integration is disabled in local mode.');
      return { result: '', choices: [{ message: { content: '' } }] };
    },
    SendEmail: async (params) => {
      console.warn('[SendEmail] Email integration is disabled in local mode.', params);
      return { success: true };
    },
    GenerateImage: async () => {
      console.warn('[GenerateImage] Image generation is disabled in local mode.');
      return { url: '' };
    },
  },
};

/* ─── Auth stub ──────────────────────────────────────────────────────────── */

const auth = {
  me: async () => {
    try {
      const raw = localStorage.getItem('edugest_session');
      if (!raw) throw new Error('No session');
      return JSON.parse(raw);
    } catch {
      throw new Error('Not authenticated');
    }
  },
  logout: (redirectUrl) => {
    localStorage.removeItem('edugest_session');
    localStorage.removeItem('edugest_role');
    window.location.href = redirectUrl || '/AppLogin';
  },
  redirectToLogin: () => {
    window.location.href = '/AppLogin';
  },
};

export const base44 = {
  entities: entitiesProxy,
  functions: functionsProxy,
  integrations,
  auth,
};
