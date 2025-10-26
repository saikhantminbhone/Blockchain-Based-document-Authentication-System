import React from 'react';
import { Link } from 'react-router-dom';
import { MailCheck } from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';

export default function KycSubmittedPage() {
  return (
    <div className="flex items-center justify-center h-full pt-10 px-4">
      <Card className="max-w-lg w-full text-center p-8">
        <MailCheck className="w-16 h-16 mx-auto text-success mb-6" />
        <h1 className="text-3xl font-bold text-text-primary mb-4">
          Submission Complete!
        </h1>
        <p className="text-text-secondary text-lg mb-8">
          Your documents have been submitted for verification. This process can take a few minutes. We will send you an email as soon as your account is approved.
        </p>
        <Link to="/dashboard">
          <Button>Back to Dashboard</Button>
        </Link>
      </Card>
    </div>
  );
}