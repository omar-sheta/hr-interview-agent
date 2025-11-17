import { useLocation, useNavigate } from 'react-router-dom';

const NotFound = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const unauthorized = location.pathname === '/unauthorized';

  return (
    <div className="auth-layout">
      <div className="card" style={{ textAlign: 'center' }}>
        <h2>{unauthorized ? 'Unauthorized' : 'Page not found'}</h2>
        <p className="muted">
          {unauthorized
            ? 'You do not have permission to view this area.'
            : 'The page you are looking for could not be found.'}
        </p>
        <button onClick={() => navigate('/')}>Return home</button>
      </div>
    </div>
  );
};

export default NotFound;
