import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { AppBar, Toolbar, Typography, Button, Box, Chip, IconButton } from '@mui/material';
import { Brightness4, Brightness7 } from '@mui/icons-material';
import hiveLogo from '../assets/hive-logo.png';

const Navbar = () => {
  const { user, logout } = useAuth();
  const { mode, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const homeUrl = user?.role === 'admin' ? '/admin' : '/candidate';

  return (
    <AppBar position="static">
      <Toolbar>
        <Box
          component={Link}
          to={homeUrl}
          sx={{ display: 'flex', alignItems: 'center', textDecoration: 'none', color: 'inherit' }}
        >
          <img src={hiveLogo} alt="HIVE Logo" style={{ height: 40, marginRight: 16 }} />
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            HR Interview Platform
          </Typography>
        </Box>
        <Box sx={{ flexGrow: 1 }} />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton sx={{ ml: 1 }} onClick={toggleTheme} color="inherit">
            {mode === 'dark' ? <Brightness7 /> : <Brightness4 />}
          </IconButton>
          {user && (
            <Box sx={{ textAlign: 'right' }}>
              <Typography variant="body1" component="div">
                {user.username}
              </Typography>
              <Chip label={user.role} size="small" color={user.role === 'admin' ? 'primary' : 'secondary'} />
            </Box>
          )}
          <Button color="inherit" variant="outlined" onClick={handleLogout}>
            Logout
          </Button>
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default Navbar;
