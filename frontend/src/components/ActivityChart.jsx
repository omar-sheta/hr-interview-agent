import { Card, CardContent, Typography, Box, useTheme, alpha } from '@mui/material';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const ActivityChart = ({ data = [] }) => {
    const theme = useTheme();

    // Transform backend data to chart format
    const chartData = data.length > 0 ? data.map(item => ({
        name: item.date || item.name,
        value: item.count || item.value || 0
    })) : [
        { name: 'Mon', value: 0 },
        { name: 'Tue', value: 0 },
        { name: 'Wed', value: 0 },
        { name: 'Thu', value: 0 },
        { name: 'Fri', value: 0 },
        { name: 'Sat', value: 0 },
        { name: 'Sun', value: 0 },
    ];

    // Calculate total and trend
    const total = chartData.reduce((sum, item) => sum + item.value, 0);
    const maxValue = Math.max(...chartData.map(d => d.value), 1);
    const maxIndex = chartData.findIndex(d => d.value === maxValue);

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
            <CardContent sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ mb: 3 }}>
                    <Typography variant="h6" fontWeight="700">
                        Interview Activity
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                        <Typography variant="h4" fontWeight="700">
                            {total}
                        </Typography>
                        <Typography variant="body2" color={total > 0 ? "success.main" : "text.secondary"} fontWeight="600">
                            {total > 0 ? '+15%' : '0%'}
                        </Typography>
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                        Last 7 Days
                    </Typography>
                </Box>

                <Box sx={{ flexGrow: 1, minHeight: 200 }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData}>
                            <XAxis
                                dataKey="name"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: theme.palette.text.secondary, fontSize: 12 }}
                                dy={10}
                            />
                            <Tooltip
                                cursor={{ fill: alpha(theme.palette.primary.main, 0.1) }}
                                contentStyle={{
                                    borderRadius: 8,
                                    border: 'none',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                                }}
                            />
                            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                                {chartData.map((entry, index) => (
                                    <Cell
                                        key={`cell-${index}`}
                                        fill={index === maxIndex ? '#2196F3' : alpha('#2196F3', 0.3)}
                                    />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </Box>
            </CardContent>
        </Card>
    );
};

export default ActivityChart;
