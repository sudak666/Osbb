import { calculateDispatcherMonthStats, closeDispatcherTicket, matchesDispatcherFilter, normalizeDispatcherDay, normalizeDispatcherMonth, reopenDispatcherTicket } from './osbb-dispatcher.js';
import { jiraIssuesFromResponse } from './osbb-state.js';
import { matchesDispatcherDateFilter, normalizeTicketPriority, ticketSortComparator } from './osbb-tickets.js';
void calculateDispatcherMonthStats; void closeDispatcherTicket; void matchesDispatcherFilter; void normalizeDispatcherDay; void normalizeDispatcherMonth; void reopenDispatcherTicket;
void jiraIssuesFromResponse; void matchesDispatcherDateFilter; void normalizeTicketPriority; void ticketSortComparator;
export declare function createOsbbDispatcherController(options: Record<string, unknown>): Record<string, (...args: any[]) => any>;
