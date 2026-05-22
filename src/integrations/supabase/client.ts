import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ifjircmfceorgobdppmu.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlmamlyY21mY2VvcmdvYmRwcG11Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkxNzk2OTEsImV4cCI6MjA3NDc1NTY5MX0.xPF1PFoLdCdm04nTjurgTK3fS6WFWAD8R0Z3fqBUujo'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)