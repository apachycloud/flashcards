import React from 'react';
import './App.css'; // Assuming styles are in App.css

interface NotificationProps {
  message: string;
  type: 'success' | 'error';
}

const Notification: React.FC<NotificationProps> = ({ message, type }) => {
  return <div className={`notification notification-${type}`}>{message}</div>;
};

export default Notification;
