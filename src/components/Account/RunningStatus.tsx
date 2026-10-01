import { Button, HStack, Popover, Text, VStack, Spinner, Badge, Box, Portal } from "@chakra-ui/react";
import { FiActivity } from "react-icons/fi";
import { useState } from "react";
import { getRunningStatus } from "@/api/Account";
import { RunningStatusResponse } from "@/interfaces/Account";
import { toaster } from "@/components/ui/toaster";

export default function RunningStatus({ compact = false }: { compact?: boolean }) {
    const [status, setStatus] = useState<RunningStatusResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);

    const fetchStatus = async () => {
        setLoading(true);
        try {
            const res = await getRunningStatus();
            setStatus(res);
        } catch (err: any) {
            toaster.create({ type: 'error', title: '获取运行状态失败', description: err?.message || '网络错误' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Popover.Root 
            open={isOpen} 
            onOpenChange={(e) => {
                setIsOpen(e.open);
                if (e.open) fetchStatus();
            }}
            positioning={{ placement: "bottom-end" }}
        >
            <Popover.Trigger asChild>
                <Button size="xs" variant="surface" colorPalette="cyan" px={compact ? 2 : undefined} aria-label="运行状态">
                    <FiActivity /> {compact ? "" : "运行状态"}
                </Button>
            </Popover.Trigger>
            <Portal>
                <Popover.Positioner>
                    <Popover.Content>
                        <Popover.Arrow />
                        <Popover.Body>
                            {loading ? (
                                <HStack justify="center" p={4}>
                                    <Spinner size="sm" />
                                    <Text fontSize="sm">加载中...</Text>
                                </HStack>
                            ) : status?.statuses ? (
                                <VStack align="stretch" gap={3}>
                                    {status.statuses.map((item, index) => (
                                        <Box key={index} p={2} borderWidth="1px" borderRadius="md" bg="bg.subtle">
                                            <HStack justify="space-between" mb={1}>
                                                <Text fontWeight="bold" fontSize="sm">{item.name}</Text>
                                                <Badge colorPalette={item.waiting > 0 ? "orange" : "green"}>
                                                    {item.waiting > 0 ? "排队中" : "空闲"}
                                                </Badge>
                                            </HStack>
                                            <HStack fontSize="xs" color="fg.muted" justify="space-between">
                                                <Text>运行中: {item.running} / {item.max_running}</Text>
                                                <Text>排队: {item.waiting}</Text>
                                            </HStack>
                                        </Box>
                                    ))}
                                    {status.statuses.length === 0 && <Text fontSize="sm" color="fg.muted">无运行状态信息</Text>}
                                </VStack>
                            ) : (
                                <Text fontSize="sm" color="fg.muted" p={2}>暂无数据</Text>
                            )}
                        </Popover.Body>
                    </Popover.Content>
                </Popover.Positioner>
            </Portal>
        </Popover.Root>
    );
}
