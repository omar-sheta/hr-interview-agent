import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import hiveLogo from '../assets/hive-logo.png';

const Navbar = ({ subtitle }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/logout');
  };

  return (
    <header className="navbar glass-panel">
      <div className="navbar__logos">
        <img src={hiveLogo} alt="HIVE" className="navbar__logo" />
      </div>
      <div
        className="navbar__brand"
        onClick={() => navigate(user?.role === 'admin' ? '/admin' : '/candidate')}
        role="button"
        tabIndex={0}
      >
        <h1>Hive Internship Interview</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      <div className="navbar__actions">
        {user && (
          <div className="navbar__user">
            <span>{user.username}</span>
            <small className="role-chip">{user.role}</small>
          </div>
        )}
        <button className="pill-button" onClick={handleLogout}>
          Logout
        </button>
      </div>
    </header>
  );
};

export default Navbar;
