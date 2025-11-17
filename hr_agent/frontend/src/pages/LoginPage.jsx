import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const LoginPage = () => {
  const navigate = useNavigate();
  const { login, isLoading } = useAuth();
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      const user = await login(form.username, form.password);
      navigate(user.role === 'admin' ? '/admin' : '/candidate');
    } catch (err) {
      setError(err.message || 'Unable to login');
    }
  };

  return (
    <div className="auth-layout">
      <div className="auth-panel card">
        <h2>Sign in</h2>
        <p>Use your demo admin or candidate account.</p>
        <form onSubmit={handleSubmit} className="form">
          <label>
            Username
            <input
              name="username"
              value={form.username}
              onChange={handleChange}
              placeholder="admin@example.com"
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              required
            />
          </label>
          {error && <div className="error-banner">{error}</div>}
          <button type="submit" disabled={isLoading}>
            {isLoading ? 'Checking...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
