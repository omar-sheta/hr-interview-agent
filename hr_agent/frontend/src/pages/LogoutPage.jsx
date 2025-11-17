import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const LogoutPage = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => navigate('/login', { replace: true }), 2200);
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="auth-layout">
      <div className="card" style={{ textAlign: 'center' }}>
        <h2>You have been logged out</h2>
        <p className="muted">For security, please close shared browsers or log back in when ready.</p>
      </div>
    </div>
  );
};

export default LogoutPage;
