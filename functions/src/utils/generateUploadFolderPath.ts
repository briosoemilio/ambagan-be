interface GenerateUploadFolderPathParams {
  projectName: string;
  projectId: string;
  userId: string;
  fileName: string;
}

export const generateUploadFolderPath = ({
  projectName,
  projectId,
  userId,
  fileName,
}: GenerateUploadFolderPathParams): string => {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const projectFolder = `${projectName}_${projectId}`;
  const dateFolder = `${month}_${year}`;
  const userFolder = `userId_${userId}`;

  return `${projectFolder}/${dateFolder}/${userFolder}/${fileName}`;
};
