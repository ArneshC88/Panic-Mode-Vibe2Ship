export interface Task {
  id: string;
  title: string;
  deadline: string;
  estimated_effort_hours: number;
  status: 'pending' | 'completed';
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  duration_minutes: number;
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: string;
  actionsExecuted?: Array<{
    name: string;
    args: any;
    result: any;
  }>;
  isPending?: boolean;
}
