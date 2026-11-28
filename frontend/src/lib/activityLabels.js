// Plain-language names for the activity log (see backend reportController ACTIONS).
export const ACTIVITY_LABELS = {
  login: 'Logged in',
  registered: 'Joined iELEVATE',
  skill_check: 'Took the pre-assessment',
  applied: 'Applied to a topic',
  application_cancelled: 'Cancelled an application',
  accepted: 'Accepted a learner',
  declined: 'Declined a learner',
  message_sent: 'Sent a message',
  session_booked: 'Requested a session',
  session_confirmed: 'Accepted a session',
  session_cancelled: 'Cancelled a session',
  session_completed: 'Marked a session done',
  session_no_show: 'Marked a session missed',
  session_posted: 'Set a face-to-face session',
  session_joined: 'Joined a face-to-face session',
  session_left: 'Left a face-to-face session',
  activity_created: 'Added an activity',
  activity_answered: 'Answered an activity',
  answer_reviewed: 'Replied to an answer',
  module_test: 'Took a topic test',
  certificate_issued: 'Issued a certificate',
  topic_reopened: 'Reopened a topic',
  portfolio_added: 'Added to their portfolio',
  recommendation_requested: 'Asked for a recommendation',
  recommendation_written: 'Wrote a recommendation',
  module_submitted: 'Sent a module for approval',
  module_approved: 'Approved a module',
  module_changes_requested: 'Asked for changes to a module',
  training_design: 'Changed the training design',
};

// Groups for the colored marker next to each entry.
export const ACTIVITY_GROUPS = {
  login: 'access', registered: 'access', skill_check: 'learning',
  applied: 'stage', application_cancelled: 'stage', accepted: 'stage', declined: 'stage',
  message_sent: 'talk',
  session_booked: 'session', session_confirmed: 'session', session_cancelled: 'session', session_completed: 'session', session_no_show: 'session',
  session_posted: 'session', session_joined: 'session', session_left: 'session',
  activity_created: 'learning', activity_answered: 'learning', answer_reviewed: 'learning', module_test: 'learning',
  certificate_issued: 'done', topic_reopened: 'stage', portfolio_added: 'learning', recommendation_requested: 'done', recommendation_written: 'done',
  module_submitted: 'learning', module_approved: 'done', module_changes_requested: 'stage',
  training_design: 'stage',
};

export const ACTIVITY_GROUP_STYLES = {
  access: 'bg-stone-400',
  stage: 'bg-accent-500',
  talk: 'bg-brand-500',
  session: 'bg-brand-300',
  learning: 'bg-accent-200',
  done: 'bg-emerald-500',
};
