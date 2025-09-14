import React, { useEffect, useState, useMemo } from 'react';
import { SafeAreaView, View, FlatList, Alert } from 'react-native';
import { Provider as PaperProvider, Text, TextInput, Button, Card, Chip, SegmentedButtons, Snackbar, Divider } from 'react-native-paper';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';

// Android: show notifications with sound by default
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const STORAGE_KEY = 'todo-pro-tasks';

export default function App() {
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [datetime, setDatetime] = useState(''); // "YYYY-MM-DDTHH:mm"
  const [priority, setPriority] = useState('low');
  const [bucket, setBucket] = useState('work');
  const [tasks, setTasks] = useState({ work: [], private: [] });
  const [snack, setSnack] = useState('');
  const [filterBucket, setFilterBucket] = useState('all');

  // Android channel with sound
  useEffect(() => {
    (async () => {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
        vibrationPattern: [0, 250, 250, 250],
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC
      });
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Notifications disabled', 'Enable notifications to get alarms with sound.');
      }
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      if (saved) setTasks(JSON.parse(saved));
    })();
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }, [tasks]);

  const pendingCounts = useMemo(() => {
    const count = (arr) => (arr || []).filter(t => !t.completed).length;
    const done = (arr) => (arr || []).filter(t => t.completed).length;
    return {
      work: { pending: count(tasks.work), done: done(tasks.work) },
      private: { pending: count(tasks.private), done: done(tasks.private) }
    };
  }, [tasks]);

  async function scheduleLocalNotification(tsIsoMinute, text) {
    const due = new Date(tsIsoMinute);
    if (isNaN(due.getTime())) return null;
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Task Due!',
        body: text,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH
      },
      trigger: due
    });
    return id;
  }

  async function addTask() {
    if (!title || !datetime) {
      setSnack('Please enter title and date/time');
      return;
    }
    const newTask = {
      text: title,
      date: datetime,
      notes,
      priority,
      completed: false,
      notifId: null
    };
    const notifId = await scheduleLocalNotification(datetime, title);
    newTask.notifId = notifId;

    const next = { ...tasks };
    next[bucket] = [...(next[bucket] || []), newTask];
    setTasks(next);

    setTitle(''); setNotes(''); setDatetime(''); setPriority('low');
    setSnack('Task added & alarm scheduled');
  }

  function toggleDone(b, idx) {
    const next = { ...tasks };
    next[b][idx].completed = !next[b][idx].completed;
    setTasks(next);
  }

  async function deleteTask(b, idx) {
    const t = tasks[b][idx];
    if (t?.notifId) {
      try { await Notifications.cancelScheduledNotificationAsync(t.notifId); } catch {}
    }
    const next = { ...tasks };
    next[b].splice(idx, 1);
    setTasks(next);
  }

  function renderTask(b) {
    return ({ item, index }) => (
      <Card style={{ backgroundColor:'#141414', marginBottom:10, borderColor:'#222', borderWidth:1 }}>
        <Card.Title titleStyle={{ color:'#fff' }} title={item.text} subtitle={`${item.date}  •  ${item.priority.toUpperCase()}`} subtitleStyle={{ color:'#e60000' }} />
        {!!item.notes && <Card.Content><Text style={{ color:'#ff8080', fontStyle:'italic' }}>{item.notes}</Text></Card.Content>}
        <Card.Actions>
          <Button mode="contained" buttonColor="#e60000" textColor="#fff" onPress={() => toggleDone(b, index)}>{item.completed ? 'Undo' : 'Done'}</Button>
          <Button mode="outlined" textColor="#e60000" onPress={() => deleteTask(b, index)} style={{ marginLeft:8 }}>Delete</Button>
        </Card.Actions>
      </Card>
    );
  }

  const listData = useMemo(() => {
    if (filterBucket === 'work') return { work: tasks.work, private: [] };
    if (filterBucket === 'private') return { work: [], private: tasks.private };
    return tasks;
  }, [filterBucket, tasks]);

  return (
    <PaperProvider>
      <SafeAreaView style={{ flex:1, backgroundColor:'#0d0d0d' }}>
        <StatusBar style="light" />
        <View style={{ padding:16 }}>
          <Text variant="headlineMedium" style={{ color:'#e60000', marginBottom:10 }}>Pro To-Do — Android Alarms</Text>

          <View style={{ flexDirection:'row', gap:8, marginBottom:8 }}>
            <TextInput mode="outlined" placeholder="Task title…" value={title} onChangeText={setTitle}
              style={{ flex:1, backgroundColor:'#1a1a1a' }} textColor="#fff" outlineColor="#e60000" />
            <TextInput mode="outlined" placeholder="YYYY-MM-DDTHH:mm" value={datetime} onChangeText={setDatetime}
              style={{ width:220, backgroundColor:'#1a1a1a' }} textColor="#fff" outlineColor="#e60000" />
          </View>

          <View style={{ flexDirection:'row', gap:8, marginBottom:8 }}>
            <SegmentedButtons
              value={priority}
              onValueChange={setPriority}
              buttons={[
                { value:'high', label:'High', style:{ backgroundColor:'#2a2a2a' }, checkedColor:'#fff' },
                { value:'mid', label:'Mid', style:{ backgroundColor:'#2a2a2a' } },
                { value:'low', label:'Low', style:{ backgroundColor:'#2a2a2a' } },
              ]}
            />
            <SegmentedButtons
              value={bucket}
              onValueChange={setBucket}
              buttons={[
                { value:'work', label:'Work', style:{ backgroundColor:'#2a2a2a' } },
                { value:'private', label:'Private', style:{ backgroundColor:'#2a2a2a' } },
              ]}
            />
          </View>

          <TextInput
            mode="outlined"
            placeholder="Notes…"
            value={notes}
            onChangeText={setNotes}
            multiline
            style={{ backgroundColor:'#1a1a1a', marginBottom:10 }}
            textColor="#fff" outlineColor="#e60000"
          />

          <View style={{ flexDirection:'row', gap:8, marginBottom:16 }}>
            <Button mode="contained" buttonColor="#e60000" textColor="#fff" onPress={addTask}>Add</Button>
            <Chip selected={filterBucket==='all'} onPress={()=>setFilterBucket('all')} style={{ backgroundColor:'#1a1a1a' }} textStyle={{ color:'#fff' }}>All</Chip>
            <Chip selected={filterBucket==='work'} onPress={()=>setFilterBucket('work')} style={{ backgroundColor:'#1a1a1a' }} textStyle={{ color:'#fff' }}>Work</Chip>
            <Chip selected={filterBucket==='private'} onPress={()=>setFilterBucket('private')} style={{ backgroundColor:'#1a1a1a' }} textStyle={{ color:'#fff' }}>Private</Chip>
          </View>

          <Divider style={{ backgroundColor:'#e60000', marginBottom:12 }} />

          <Text style={{ color:'#bbb', marginBottom:8 }}>
            Work: {pendingCounts.work.pending} pending, {pendingCounts.work.done} completed • Private: {pendingCounts.private.pending} pending, {pendingCounts.private.done} completed
          </Text>

          <View style={{ flexDirection:'row', gap:12 }}>
            <View style={{ flex:1 }}>
              <Text style={{ color:'#e60000', marginBottom:8 }}>Work Tasks</Text>
              <FlatList data={listData.work} keyExtractor={(_,i)=>'w'+i} renderItem={renderTask('work')} />
            </View>
            <View style={{ flex:1 }}>
              <Text style={{ color:'#e60000', marginBottom:8 }}>Private Tasks</Text>
              <FlatList data={listData.private} keyExtractor={(_,i)=>'p'+i} renderItem={renderTask('private')} />
            </View>
          </View>

        </View>
        <Snackbar visible={!!snack} onDismiss={()=>setSnack('')} duration={2000}>{snack}</Snackbar>
      </SafeAreaView>
    </PaperProvider>
  );
}
