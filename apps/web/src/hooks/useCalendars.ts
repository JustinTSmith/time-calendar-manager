'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  GetCalendarsResponse,
  PatchCalendarBody,
  PatchCalendarResponse,
} from '@time-calendar-manager/types';
import { apiClient } from '@/lib/apiClient';

export const CALENDARS_QUERY_KEY = ['calendars'] as const;

export function useCalendarsQuery() {
  return useQuery<GetCalendarsResponse>({
    queryKey: CALENDARS_QUERY_KEY,
    queryFn: () => apiClient.get<GetCalendarsResponse>('/api/v1/calendars'),
  });
}

export function usePatchCalendar() {
  const queryClient = useQueryClient();

  return useMutation<PatchCalendarResponse, Error, { id: string } & PatchCalendarBody>({
    mutationFn: ({ id, ...body }) =>
      apiClient.patch<PatchCalendarResponse>(`/api/v1/calendars/${id}`, body),

    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: CALENDARS_QUERY_KEY });
      const previous = queryClient.getQueryData<GetCalendarsResponse>(CALENDARS_QUERY_KEY);

      queryClient.setQueryData<GetCalendarsResponse>(CALENDARS_QUERY_KEY, (old) => {
        if (!old) return old;
        return {
          ...old,
          accounts: old.accounts.map((acct) => ({
            ...acct,
            calendars: acct.calendars.map((cal) =>
              cal.id === variables.id
                ? {
                    ...cal,
                    ...(variables.is_visible !== undefined && { isVisible: variables.is_visible }),
                    ...(variables.color !== undefined && { color: variables.color }),
                  }
                : cal,
            ),
          })),
        };
      });

      return { previous };
    },

    onError: (_err, _vars, context) => {
      const ctx = context as { previous?: GetCalendarsResponse } | undefined;
      if (ctx?.previous) {
        queryClient.setQueryData(CALENDARS_QUERY_KEY, ctx.previous);
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: CALENDARS_QUERY_KEY });
    },
  });
}
