import { Box, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Typography, Avatar, useTheme, alpha } from '@mui/material';
import { Dashboard, VideoCameraFront, Group, BarChart, Settings, AssignmentTurnedIn } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { Link, useLocation } from 'react-router-dom';
import hiveLogo from '../assets/hive-logo.png';

const Sidebar = () => {
    const theme = useTheme();
    const { user } = useAuth();
    const location = useLocation();

    const menuItems = [
        { text: 'Dashboard', icon: <Dashboard />, path: '/admin' },
        { text: 'Interviews', icon: <VideoCameraFront />, path: '/admin/interviews' },
        { text: 'Candidates', icon: <Group />, path: '/admin/candidates' },
        { text: 'Results', icon: <AssignmentTurnedIn />, path: '/admin/results' },
        { text: 'Analytics', icon: <BarChart />, path: '/admin/analytics' },
        { text: 'Settings', icon: <Settings />, path: '/admin/settings' },
    ];

    return (
        <Box
            sx={{
                width: 280,
                height: '100vh',
                bgcolor: '#1a1f2e', // Dark background from reference
                color: 'white',
                display: 'flex',
                flexDirection: 'column',
                position: 'fixed',
                left: 0,
                top: 0,
                borderRight: '1px solid rgba(255,255,255,0.1)',
            }}
        >
            {/* Logo Section */}
            <Box sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
                <img src={hiveLogo} alt="Hive Logo" style={{ width: 32, height: 32 }} />
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
                                component={Link}
                                to={item.path}
                                sx={{
                                    borderRadius: 2,
                                    bgcolor: isActive ? alpha(theme.palette.primary.main, 0.15) : 'transparent',
                                    color: isActive ? theme.palette.primary.main : '#94a3b8',
                                    '&:hover': {
                                        bgcolor: alpha(theme.palette.primary.main, 0.1),
                                        color: 'white',
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
            <Box sx={{ mt: 'auto', p: 3, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Avatar sx={{ bgcolor: theme.palette.primary.main }}>
                        {user?.username?.[0]?.toUpperCase() || 'A'}
                    </Avatar>
                    <Box>
                        <Typography variant="subtitle2" fontWeight="600">
                            {user?.username || 'Admin User'}
                        </Typography>
                        <Typography variant="caption" color="#94a3b8">
                            Admin
                        </Typography>
                    </Box>
                </Box>
            </Box>
        </Box>
    );
};

export default Sidebar;
