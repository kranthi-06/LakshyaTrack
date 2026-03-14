import api from './api';

export type MediaType =
    | 'resume'
    | 'profile_image'
    | 'portfolio_image'
    | 'certificate'
    | 'project_image';

export interface UploadMediaResponse {
    media_type: MediaType;
    secure_url: string;
    folder: string;
    persisted_field?: string | null;
}

export const uploadUserMedia = async (file: File, mediaType: MediaType): Promise<UploadMediaResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('media_type', mediaType);

    const response = await api.post('/media/upload', formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });

    return response.data;
};
