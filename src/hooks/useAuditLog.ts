import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export const useAuditLog = () => {
  const { user, profile } = useAuth();

  const logAction = async (params: {
    action: string;
    entity: string;
    entityId?: string;
    fieldName?: string;
    oldValue?: string;
    newValue?: string;
    details?: string;
  }) => {
    if (!user) return;
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      user_name: profile?.full_name || user.email,
      user_email: user.email,
      action: params.action,
      entity: params.entity,
      entity_id: params.entityId,
      field_name: params.fieldName,
      old_value: params.oldValue,
      new_value: params.newValue,
      details: params.details,
    });
  };

  return { logAction };
};
