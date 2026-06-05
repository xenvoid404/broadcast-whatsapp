export interface Config {
    id: number;
    start: number;
    end: number;
    link_threshold: number;
}

export interface Message {
    id: number;
    text: string;
    image: string | null;
}

export interface Link {
    id: number;
    url: string;
    sender_name: string;
    source_group_name: string;
    collected_at: string;
    is_sent: number;
}

export interface Schedule {
    id: number;
    group_jid: string;
    scheduled_time: string;
    scheduled_date: string;
    status: 'pending' | 'sent' | 'failed';
    sent_at: string | null;
}
