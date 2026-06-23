import React, { useState } from 'react';
import { View, StyleSheet, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TodayScreen } from './TodayScreen';
import { FavoritesScreen } from './FavoritesScreen';
import { StatsScreen } from './StatsScreen';
import { ProfileScreen } from './ProfileScreen';
import { TabNavigator } from '../components/TabNavigator';
import { SyncStatusPill } from '../components/SyncStatusPill';
import { colors } from '../theme/colors';

type TabName = 'today' | 'favorites' | 'stats' | 'profile';

export function MainApp() {
    const [activeTab, setActiveTab] = useState<TabName>('today');

    const handleTabChange = (tab: TabName) => {
        setActiveTab(tab);
    };

    const renderContent = () => {
        switch (activeTab) {
            case 'today':
                return <TodayScreen />;
            case 'favorites':
                return <FavoritesScreen onAddToToday={() => setActiveTab('today')} />;
            case 'stats':
                return <StatsScreen onClose={() => setActiveTab('today')} />;
            case 'profile':
                return <ProfileScreen onClose={() => setActiveTab('today')} />;
            default:
                return <TodayScreen />;
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.content}>
                {renderContent()}
            </View>
            <SyncStatusPill />
            <TabNavigator activeTab={activeTab} onTabChange={handleTabChange} />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    content: {
        flex: 1,
    },
});
