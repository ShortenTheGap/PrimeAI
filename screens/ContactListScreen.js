import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  TextInput,
  Image,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from '../services/ApiService';
import API from '../config/api';

// Cache configuration
const CACHE_KEY = '@contacts:list';
const CACHE_TIMESTAMP_KEY = '@contacts:timestamp';
const CACHE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

const ContactListScreen = () => {
  const navigation = useNavigation();
  const [contacts, setContacts] = useState([]);
  const [filteredContacts, setFilteredContacts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);

  useFocusEffect(
    React.useCallback(() => {
      loadContactsWithCache();
    }, [])
  );

  // Load contacts with smart caching
  const loadContactsWithCache = async () => {
    try {
      // Step 1: Load from cache first (instant display)
      const cachedData = await loadFromCache();

      if (cachedData) {
        console.log(`📦 Loaded ${cachedData.contacts.length} contacts from cache`);
        setContacts(cachedData.contacts);
        setFilteredContacts(cachedData.contacts);
        setLastSyncTime(cachedData.timestamp);

        // Check if cache is stale
        const now = Date.now();
        const cacheAge = now - cachedData.timestamp;
        const isStale = cacheAge > CACHE_EXPIRY_MS;

        console.log(`⏰ Cache age: ${Math.round(cacheAge / 1000)}s, ${isStale ? 'STALE' : 'FRESH'}`);

        // Step 2: Sync from server in background if stale
        if (isStale) {
          console.log('🔄 Cache is stale, syncing from server in background...');
          await syncFromServer(false); // Background sync, no loading indicator
        }
      } else {
        // No cache, fetch from server with loading indicator
        console.log('📭 No cache found, loading from server...');
        setIsLoading(true);
        await syncFromServer(true);
      }
    } catch (error) {
      console.error('Error loading contacts with cache:', error);
      // Fallback to server if cache fails
      setIsLoading(true);
      await syncFromServer(true);
    }
  };

  // Load contacts from cache
  const loadFromCache = async () => {
    try {
      const [contactsJson, timestampStr] = await Promise.all([
        AsyncStorage.getItem(CACHE_KEY),
        AsyncStorage.getItem(CACHE_TIMESTAMP_KEY),
      ]);

      if (contactsJson && timestampStr) {
        return {
          contacts: JSON.parse(contactsJson),
          timestamp: parseInt(timestampStr, 10),
        };
      }
      return null;
    } catch (error) {
      console.error('Error reading from cache:', error);
      return null;
    }
  };

  // Save contacts to cache
  const saveToCache = async (contactsList) => {
    try {
      const timestamp = Date.now();
      await Promise.all([
        AsyncStorage.setItem(CACHE_KEY, JSON.stringify(contactsList)),
        AsyncStorage.setItem(CACHE_TIMESTAMP_KEY, timestamp.toString()),
      ]);
      setLastSyncTime(timestamp);
      console.log(`💾 Saved ${contactsList.length} contacts to cache`);
    } catch (error) {
      console.error('Error saving to cache:', error);
    }
  };

  // Sync from server
  const syncFromServer = async (showLoading = true) => {
    if (showLoading) {
      setIsLoading(true);
    }

    try {
      console.log(`🌐 Syncing contacts from server (${API.ENV_NAME})...`);
      const response = await apiClient.get('/api/contacts');
      const contactsList = response.data || [];

      console.log(`✅ Synced ${contactsList.length} contacts from server`);
      setContacts(contactsList);
      setFilteredContacts(contactsList);

      // Save to cache
      await saveToCache(contactsList);

      return contactsList;
    } catch (error) {
      console.error('Error syncing from server:', error);

      let errorMessage = 'Failed to sync contacts';
      if (error.request) {
        errorMessage = 'Cannot reach server. Showing cached data.';
      }

      // Only show alert if we have no cached data
      if (contacts.length === 0) {
        Alert.alert('Error', errorMessage);
        setContacts([]);
        setFilteredContacts([]);
      } else {
        // Just log, don't interrupt user
        console.warn('⚠️ Sync failed, using cached data');
      }
    } finally {
      if (showLoading) {
        setIsLoading(false);
      }
      setIsRefreshing(false);
    }
  };

  // Pull to refresh handler
  const onRefresh = async () => {
    setIsRefreshing(true);
    await syncFromServer(false);
  };

  // Clear cache (useful for debugging or force refresh)
  const clearCache = async () => {
    try {
      await AsyncStorage.multiRemove([CACHE_KEY, CACHE_TIMESTAMP_KEY]);
      setLastSyncTime(null);
      console.log('🗑️ Cache cleared');
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  };

  // Format last sync time
  const formatSyncTime = (timestamp) => {
    if (!timestamp) return '';
    const now = Date.now();
    const diff = Math.floor((now - timestamp) / 1000); // seconds

    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  const handleSearch = (query) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setFilteredContacts(contacts);
      return;
    }

    const filtered = contacts.filter((contact) =>
      contact.name?.toLowerCase().includes(query.toLowerCase()) ||
      contact.phone?.includes(query) ||
      contact.email?.toLowerCase().includes(query.toLowerCase())
    );
    setFilteredContacts(filtered);
  };

  const deleteContact = async (contactId) => {
    Alert.alert(
      'Delete Contact',
      'Are you sure you want to delete this contact?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log(`Deleting contact ${contactId} from cloud...`);
              await apiClient.delete(`/api/contacts/${contactId}`);

              // Invalidate cache and reload from server
              await clearCache();
              await syncFromServer(true);

              Alert.alert('✅ Success', 'Contact deleted from cloud');
            } catch (error) {
              console.error('Error deleting contact:', error);
              Alert.alert('❌ Error', 'Failed to delete contact');
            }
          },
        },
      ]
    );
  };

    const sendFollowUpReminder = async (contact) => {
      try {
        const masterFlowUrl = await AsyncStorage.getItem('@webhook:master_flow');

        if (!masterFlowUrl) {
          Alert.alert('Webhook Not Configured', 'Please configure the N8N Master Flow URL in Settings first.');
          return;
        }

        const payload = {
          action: 'follow',
          contact: {
            id: contact.contact_id || contact.id,
            name: contact.name,
            phone: contact.phone,
            email: contact.email,
          },
          audio_base64: null,  // Skip audio to keep payload small
          hasRecording: contact.has_recording || false,
          photoUrl: contact.photo_url || null,
          hasPhoto: !!contact.photo_url,
          createdAt: contact.created_at,
          updatedAt: contact.updated_at,
          timestamp: new Date().toISOString(),
        };

        console.log('Sending follow-up webhook');

        const response = await fetch(masterFlowUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          Alert.alert('✅ Success!', 'Follow-up reminder sent successfully!');
        } else {
          Alert.alert('❌ Error', `Webhook failed with status: ${response.status}`);
        }
      } catch (error) {
        console.error('Webhook error:', error);
        Alert.alert('❌ Error', `Failed to send reminder: ${error.message}`);
      }
    };

  const convertRecordingToBase64 = async (uri) => {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('Error converting recording to base64:', error);
      return null;
    }
  };

    const renderContact = ({ item }) => (
      <View style={styles.contactCard}>
        <View style={styles.contactHeader}>
          <View style={styles.avatar}>
            {item.photoUrl ? (
              <Image source={{ uri: item.photoUrl }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>
                {item.name ? item.name.charAt(0).toUpperCase() : '?'}
              </Text>
            )}
          </View>
          <View style={styles.contactInfo}>
            <Text style={styles.contactName}>{item.name || 'No name'}</Text>
            <Text style={styles.contactDetails}>{item.phone || 'No phone'}</Text>
            {item.email && <Text style={styles.contactDetails}>{item.email}</Text>}
          </View>
        </View>

        {item.has_recording && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>🎙️ Has recording</Text>
          </View>
        )}

        <View style={styles.contactActions}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => navigation.navigate('ContactCapture', { mode: 'edit', contact: item })}
          >
            <Text style={styles.actionBtnText}>✏️ Edit</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.reminderBtn]}
            onPress={() => sendFollowUpReminder(item)}
          >
            <Text style={styles.actionBtnText}>🔔 Follow-up</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.deleteBtn]}
            onPress={() => deleteContact(item.contact_id || item.id)}
          >
            <Text style={styles.actionBtnText}>🗑️ Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Contact List</Text>
        <View style={styles.cloudBanner}>
          <Text style={styles.cloudBannerText}>
            ☁️ {API.ENV_NAME}
            {lastSyncTime && ` • Last sync: ${formatSyncTime(lastSyncTime)}`}
          </Text>
        </View>
        <TextInput
          style={styles.searchInput}
          placeholder="Search contacts..."
          placeholderTextColor="#64748b"
          value={searchQuery}
          onChangeText={handleSearch}
        />
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366f1" />
          <Text style={styles.loadingText}>Loading contacts from cloud...</Text>
        </View>
      ) : filteredContacts.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>
            {searchQuery ? 'No contacts found' : 'No contacts yet.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredContacts}
          renderItem={renderContact}
          keyExtractor={(item) => (item.contact_id || item.id || item.name).toString()}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              tintColor="#6366f1"
              colors={["#6366f1"]}
              title="Pull to refresh"
              titleColor="#94a3b8"
            />
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#f1f5f9',
    marginBottom: 8,
  },
  cloudBanner: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    padding: 8,
    borderRadius: 6,
    marginBottom: 12,
  },
  cloudBannerText: {
    color: '#10b981',
    fontSize: 12,
    fontWeight: '600',
  },
  searchInput: {
    backgroundColor: '#1e293b',
    color: '#f1f5f9',
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
  },
  listContent: {
    padding: 16,
  },
  contactCard: {
    backgroundColor: '#1e293b',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  contactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  avatarImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  avatarText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#f1f5f9',
    marginBottom: 4,
  },
  contactDetails: {
    fontSize: 14,
    color: '#94a3b8',
  },
  badge: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    padding: 8,
    borderRadius: 6,
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  badgeText: {
    color: '#6366f1',
    fontSize: 12,
    fontWeight: '600',
  },
  photoBadge: {
    color: '#10b981',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 12,
  },
  contactActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionBtn: {
    flex: 1,
    backgroundColor: '#334155',
    padding: 10,
    borderRadius: 8,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  reminderBtn: {
    backgroundColor: '#f59e0b',
  },
  deleteBtn: {
    backgroundColor: '#ef4444',
  },
  actionBtnText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#64748b',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 24,
  },
});

export default ContactListScreen;
