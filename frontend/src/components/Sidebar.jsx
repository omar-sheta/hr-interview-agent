import { Box, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Typography, Avatar, useTheme, alpha, IconButton } from '@mui/material';
import { Dashboard, VideoCameraFront, Group, BarChart, Settings, AssignmentTurnedIn, Brightness4, Brightness7, Logout } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { useTheme as useAppTheme } from '../context/ThemeContext';
import { Link, useLocation } from 'react-router-dom';
import hiveLogo from '../assets/hive-logo.png';

const Sidebar = () => {
    const theme = useTheme();
    const { mode, toggleTheme } = useAppTheme();
    const { user, logout } = useAuth();
    const location = useLocation();

    const handleLogout = async () => {
        await logout();
        // Navigation is handled by AuthContext/App routing usually, but we can force it if needed
        // window.location.href = '/login'; 
    };

    const menuItems = [
        { text: 'Dashboard', icon: <Dashboard />, path: '/admin' },
        { text: 'Interviews', icon: <VideoCameraFront />, path: '/admin/interviews' },
        { text: 'Candidates', icon: <Group />, path: '/admin/candidates' },
        { text: 'Results', icon: <AssignmentTurnedIn />, path: '/admin/results' },
        { text: 'Analytics', icon: <BarChart />, path: '/admin/analytics' },
        { text: 'Settings', icon: <Settings />, path: '/admin/settings', disabled: true },
    ];

    return (
        <Box
            sx={{
                width: 280,
                height: '100vh',
                bgcolor: 'background.paper',
                color: 'text.primary',
                display: 'flex',
                flexDirection: 'column',
                position: 'fixed',
                left: 0,
                top: 0,
                borderRight: 1,
                borderColor: 'divider',
            }}
        >
            {/* Logo Section */}
            <Box sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box
                    sx={{
                        width: 40,
                        height: 40,
                        bgcolor: 'primary.main',
                        borderRadius: 2,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 0 10px rgba(0,0,0,0.1)',
                    }}
                >
                    <img src={hiveLogo} alt="Hive Logo" style={{ width: 24, height: 'auto' }} />
                </Box>
                <Typography variant="h6" fontWeight="bold" sx={{ letterSpacing: 0.5 }}>
                    AI-HR Platform
                </Typography>
            </Box>

            {/* Navigation */}
            <List sx={{ px: 2, mt: 2 }}>
                {menuItems.map((item) => {
                    const isActive = location.pathname === item.path || (item.path !== '/admin' && location.pathname.startsWith(item.path));
                    return (
                        <ListItem key={item.text} disablePadding sx={{ mb: 1 }}>
                            <ListItemButton
                                component={item.disabled ? 'div' : Link}
                                to={item.disabled ? undefined : item.path}
                                disabled={item.disabled}
                                sx={{
                                    borderRadius: 2,
                                    bgcolor: isActive ? alpha(theme.palette.primary.main, 0.15) : 'transparent',
                                    color: item.disabled ? 'text.disabled' : (isActive ? theme.palette.primary.main : '#94a3b8'),
                                    cursor: item.disabled ? 'not-allowed' : 'pointer',
                                    opacity: item.disabled ? 0.5 : 1,
                                    '&:hover': {
                                        bgcolor: item.disabled ? 'transparent' : alpha(theme.palette.primary.main, 0.1),
                                        color: item.disabled ? 'text.disabled' : 'white',
                                    },
                                }}
                            >
                                <ListItemIcon sx={{ color: 'inherit', minWidth: 40 }}>
                                    {item.icon}
                                </ListItemIcon>
                                <ListItemText
                                    primary={item.text}
                                    primaryTypographyProps={{ fontWeight: isActive ? 600 : 500 }}
                                />
                            </ListItemButton>
                        </ListItem>
                    );
                })}
            </List>

            {/* User Profile Section */}
            <Box sx={{ mt: 'auto', p: 3, borderTop: 1, borderColor: 'divider' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                    <IconButton onClick={toggleTheme} color="inherit">
                        {mode === 'dark' ? <Brightness7 /> : <Brightness4 />}
                    </IconButton>
                    <IconButton onClick={handleLogout} color="inherit">
                        <Logout />
                    </IconButton>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Avatar sx={{ bgcolor: theme.palette.primary.main }}>
                        {user?.username?.[0]?.toUpperCase() || 'A'}
                    </Avatar>
                    <Box>
                        <Typography variant="subtitle2" fontWeight="600">
                            {user?.username || 'Admin User'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            Admin
                        </Typography>
                    </Box>
                </Box>
            </Box>
        </Box>
    );
};

export default Sidebar;
