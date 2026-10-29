import React, { useState, useEffect, useCallback } from 'react';
import { API_BASE, getAuthHeaders } from '../../services/api.js';

export function UserManager({ token, showToast }) {
  const [users, setUsers] = useState([]);
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('DOSEN');
  const [loading, setLoading] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/v1/admin/users`, {
        headers: getAuthHeaders(token),
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.data)) {
        setUsers(data.data);
      }
    } catch (_) {}
  }, [token]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!username || !password || !fullName) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/v1/admin/users`, {
        method: 'POST',
        headers: getAuthHeaders(token),
        body: JSON.stringify({ username, password, fullName, role }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || 'Akun berhasil dibuat', 'success');
        setFullName('');
        setUsername('');
        setPassword('');
        fetchUsers();
      } else {
        showToast(data.message || 'Gagal membuat akun', 'error');
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (id, uname) => {
    try {
      const res = await fetch(`${API_BASE}/v1/admin/users/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(token),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`Akun ${uname} dihapus`, 'success');
        fetchUsers();
      } else {
        showToast(data.message || 'Gagal menghapus akun', 'error');
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '320px 1fr',
        gap: 14,
        flex: 1,
        minHeight: 0,
      }}
    >
      <div className="quiz-sidebar" style={{ padding: 16 }}>
        <h3 style={{ fontSize: '0.92rem', marginBottom: 12 }}>
          ➕ Tambah Akun Dosen / Admin
        </h3>
        <form
          onSubmit={handleCreateUser}
          style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
        >
          <div className="field-group">
            <label>Nama Lengkap & Gelar</label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Contoh: Dr. Budi Santoso, M.Kom"
            />
          </div>
          <div className="field-group">
            <label>Username</label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Contoh: dosen_web"
            />
          </div>
          <div className="field-group">
            <label>Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimal 6 karakter"
            />
          </div>
          <div className="field-group">
            <label>Role Akses</label>
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="DOSEN">DOSEN (Kelola Soal & Nilai)</option>
              <option value="PROCTOR">PROCTOR (Pengawas Live Monitor)</option>
              <option value="SUPERADMIN">SUPERADMIN (Full Akses)</option>
            </select>
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ justifyContent: 'center', marginTop: 6 }}
          >
            {loading ? 'Menyimpan...' : '💾 Buat Akun Baru'}
          </button>
        </form>
      </div>

      <div className="workspace-panel">
        <div className="table-scroll-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Nama Lengkap</th>
                <th>Username</th>
                <th>Role</th>
                <th>Tanggal Dibuat</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan="6" className="empty-state">
                    Belum ada data pengguna.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id}>
                    <td>#{u.id}</td>
                    <td style={{ fontWeight: 700 }}>{u.full_name || '-'}</td>
                    <td>{u.username}</td>
                    <td>
                      <span
                        className={`badge ${
                          u.role === 'SUPERADMIN' ? 'badge-info' : 'badge-neutral'
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td>
                      {u.created_at
                        ? new Date(u.created_at).toLocaleString('id-ID')
                        : '-'}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-danger btn-xs"
                        onClick={() => handleDeleteUser(u.id, u.username)}
                      >
                        🗑️ Hapus
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
