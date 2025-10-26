// src/components/Notifications.js

import { toast } from 'react-hot-toast';
import Toast from '../components/ui/Toast';

export const showSuccessToast = (message, title = 'Success', duration = 3000) => {
  toast.custom(
    (t) => (
      <Toast
        t={t}
        type="success"
        title={title}
        message={message}
      />
    ),
    { duration: duration }
  );
};

export const showErrorToast = (message, title = 'An Error Occurred', duration = 5000) => {
  toast.custom(
    (t) => (
      <Toast
        t={t}
        type="error"
        title={title}
        message={message}
      />
    ),
    { duration: duration }
  );
};