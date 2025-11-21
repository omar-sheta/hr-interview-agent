import { Card, CardContent, Typography, Box, useTheme, alpha } from '@mui/material';

const StatsCard = ({ title, value, trend, trendLabel, color = 'primary' }) => {
    const theme = useTheme();
    const isPositive = trend > 0;

    return (
        <Card
            sx={{
                height: '100%',
                borderRadius: 4,
                backdropFilter: 'blur(10px)',
                backgroundColor: alpha(theme.palette.background.paper, 0.6),
                boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.07)',
                border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
            }}
        >
            <CardContent sx={{ p: 3 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontWeight: 500 }}>
                    {title}
                </Typography>
                <Typography variant="h3" fontWeight="700" sx={{ mb: 2 }}>
                    {value}
                </Typography>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography
                        variant="body2"
                        sx={{
                            color: isPositive ? theme.palette.success.main : theme.palette.error.main,
                            fontWeight: 600,
                            bgcolor: alpha(isPositive ? theme.palette.success.main : theme.palette.error.main, 0.1),
                            px: 1,
                            py: 0.5,
                            borderRadius: 1,
                        }}
                    >
                        {isPositive ? '+' : ''}{trend}%
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                        {trendLabel}
                    </Typography>
                </Box>
            </CardContent>
        </Card>
    );
};

export default StatsCard;
