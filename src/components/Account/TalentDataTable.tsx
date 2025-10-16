import { Table, Thead, Tbody, Tr, Th, Td, TableContainer, useColorModeValue, Box } from '@chakra-ui/react';
import { useMemo } from 'react';

interface TalentData {
    talent_levels: Record<string, number>;
    skill_tree: string;
    team_skill: number;
}

interface UserTalentData {
    user_name: string;
    uid?: number;
    data_time?: string;
    jewel?: number;
    mother_stone?: number;
    star_cup?: number;
    heart_fragment?: number;
    user_info?: string[];
    talent_data: TalentData;
}

interface TalentDataTableProps {
    logContent: string | undefined;
}

export function TalentDataTable({ logContent }: TalentDataTableProps) {
    // 解析日志内容，提取用户天赋数据
    const userTalentData = useMemo(() => {
        if (!logContent) return [];

        const userDataArray: UserTalentData[] = [];
        
        // 检查是否是新格式（以 ===用户名=== 开头）
        if (logContent.startsWith('===')) {
            const userSections = logContent.split('===');
            
            // 两两一组处理（用户名 + 数据）
            for (let i = 1; i < userSections.length; i += 2) {
                const userName = userSections[i].trim();
                const section = userSections[i + 1];
                
                if (!userName || !section) continue;

                const talentDataMatch = section.match(/{.*}/s);
                if (talentDataMatch) {
                    try {
                        const talentData = JSON.parse(talentDataMatch[0]) as TalentData;
                        
                        // 提取时间信息
                        const dateTimeMatch = section.match(/\[(.*?)\]/);
                        
                        const userTalent: UserTalentData = {
                            user_name: userName,
                            data_time: dateTimeMatch?.[1],
                            user_info: dateTimeMatch ? ['数据时间'] : [],
                            talent_data: talentData
                        };

                        userDataArray.push(userTalent);
                    } catch (e) {
                        console.error('解析天赋数据失败:', e);
                    }
                }
            }
        } else {
            // 处理旧格式日志
            try {
                // 提取日志中的 JSON 部分
                const logMatch = logContent.match(/{.*}/s);
                if (logMatch) {
                    const logData = JSON.parse(logMatch[0]) as Partial<{
                        talent_levels: Record<string, number>;
                        skill_tree: string;
                        team_skill: number;
                    }>;
                    
                    // 从日志内容中提取用户名（在第一个 === 之前）
                    const userNameMatch = logContent.match(/===(.*?)===/);
                    
                    const userTalent: UserTalentData = {
                        user_name: userNameMatch?.[1] ?? '我我', // 默认用户名
                        user_info: [], // 新格式不包含额外信息
                        talent_data: {
                            talent_levels: logData.talent_levels ?? {},
                            skill_tree: logData.skill_tree ?? '',
                            team_skill: logData.team_skill ?? 0
                        }
                    };
                    
                    userDataArray.push(userTalent);
                }
            } catch (e) {
                console.error('解析旧格式日志失败:', e);
            }
        }

        return userDataArray;
    }, [logContent]);

    const bgColor = useColorModeValue('white', 'gray.700');
    const headerBgColor = useColorModeValue('gray.100', 'gray.600');

    if (userTalentData.length === 0) {
        return null;
    }

    // 属性类型映射
    const attributeMap = [
        { key: '1', name: '火' },
        { key: '2', name: '水' },
        { key: '3', name: '风' },
        { key: '4', name: '光' },
        { key: '5', name: '暗' }
    ];
    
    // 获取第一个用户的信息列配置
    const infoColumns = userTalentData[0]?.user_info?.length ? userTalentData[0].user_info : [];

    return (
        <Box mt={4} rounded="lg" bg={bgColor} boxShadow="lg">
            <TableContainer>
                <Table size="sm" variant="unstyled">
                    <Thead position="sticky" top={0} zIndex={1} bg={headerBgColor}>
                        <Tr>
                            <Th outline="1px solid gray" p={1} position="sticky" left={0} bg={headerBgColor} zIndex={2}>
                                用户名
                            </Th>
                            {infoColumns.includes('数据时间') && (
                                <Th border="1px solid gray" p={1}>
                                    数据时间
                                </Th>
                            )}
                            {attributeMap.map(attr => (
                                <Th key={attr.key} textAlign="center" fontSize="xs" border="1px solid gray" p={1}>
                                    {attr.name}
                                </Th>
                            ))}
                            <Th border="1px solid gray" p={1}>
                                属性技能
                            </Th>
                            <Th border="1px solid gray" p={1}>
                                大师技能
                            </Th>
                        </Tr>
                    </Thead>
                    <Tbody>
                        {userTalentData.map((user) => (
                            <Tr key={user.user_name}>
                                <Td outline="1px solid gray" p={1} position="sticky" left={0} bg={headerBgColor} zIndex={2}>
                                    {user.user_name}
                                </Td>
                                {infoColumns.includes('数据时间') && (
                                    <Td border="1px solid gray" p={1}>
                                        {user.data_time}
                                    </Td>
                                )}
                                {attributeMap.map(attr => (
                                    <Td key={attr.key} textAlign="center" border="1px solid gray" p={1}>
                                        {user.talent_data.talent_levels[attr.key]}
                                    </Td>
                                ))}
                                <Td border="1px solid gray" p={1}>
                                    {user.talent_data.skill_tree}
                                </Td>
                                <Td border="1px solid gray" p={1}>
                                    {user.talent_data.team_skill}
                                </Td>
                            </Tr>
                        ))}
                    </Tbody>
                </Table>
            </TableContainer>
        </Box>
    );
}