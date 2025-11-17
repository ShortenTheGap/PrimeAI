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
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ContactListScreen = () => {
  const navigation = useNavigation();
  const [contacts, setContacts] = useState([]);
  const [filteredContacts, setFilteredContacts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  useFocusEffect(
    React.useCallback(() => {
      loadContacts();
    }, [])
  );

  const loadContacts = async () => {
    try {
      const stored = await AsyncStorage.getItem('@contacts:list');
      const contactsList = stored ? JSON.parse(stored) : [];
      setContacts(contactsList);
      setFilteredContacts(contactsList);
    } catch (error) {
      console.error('Error loading contacts:', error);
    }
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

  const deleteContact = async (id) => {
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
              const updatedContacts = contacts.filter(c => c.id !== id);
              await AsyncStorage.setItem('@contacts:list', JSON.stringify(updatedContacts));
              
              setContacts(updatedContacts);
              if (searchQuery.trim()) {
                const filtered = updatedContacts.filter((contact) =>
                  contact.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  contact.phone?.includes(searchQuery) ||
                  contact.email?.toLowerCase().includes(searchQuery.toLowerCase())
                );
                setFilteredContacts(filtered);
              } else {
                setFilteredContacts(updatedContacts);
              }
              
              Alert.alert('Success', 'Contact deleted');
            } catch (error) {
              console.error('Error deleting contact:', error);
              Alert.alert('Error', 'Failed to delete contact');
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
            name: contact.name,
            phone: contact.phone,
            email: contact.email,
          },
          audio_base64: null,  // Skip audio to keep payload small
          hasRecording: contact.hasRecording || false,
          photoUrl: contact.photoUrl || null,
          hasPhoto: contact.hasPhoto || false,
          createdAt: contact.createdAt,
          updatedAt: contact.updatedAt,
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

        {item.hasRecording && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>🎙️ Has recording</Text>
          </View>
        )}

        {item.transcript && (
          <View style={styles.transcriptCard}>
            <Text style={styles.transcriptLabel}>📝 Transcript:</Text>
            <Text style={styles.transcriptText}>{item.transcript}</Text>
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
            onPress={() => deleteContact(item.id)}
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
        <TextInput
          style={styles.searchInput}
          placeholder="Search contacts..."
          placeholderTextColor="#64748b"
          value={searchQuery}
          onChangeText={handleSearch}
        />
      </View>

      {filteredContacts.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>
            {searchQuery ? 'No contacts found' : 'No contacts yet.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredContacts}
          renderItem={renderContact}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
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
    marginBottom: 12,
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
    transcriptCard: {
      backgroundColor: '#0f172a',
      padding: 12,
      borderRadius: 8,
      marginBottom: 12,
      borderLeftWidth: 3,
      borderLeftColor: '#6366f1',
    },
    transcriptLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: '#6366f1',
      marginBottom: 6,
      textTransform: 'uppercase',
    },
    transcriptText: {
      fontSize: 14,
      color: '#cbd5e1',
      lineHeight: 20,
    },
});

export default ContactListScreen;
