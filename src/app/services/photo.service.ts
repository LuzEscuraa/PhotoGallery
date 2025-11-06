import { AlertController } from '@ionic/angular';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Preferences } from '@capacitor/preferences';
import { Injectable } from '@angular/core';
import { Camera, CameraResultType, CameraSource, Photo } from '@capacitor/camera';

export interface UserPhoto {
  filepath: string;
  webviewPath?: string;
}

@Injectable({
  providedIn: 'root'
})
export class PhotoService {
  public photos: UserPhoto[] = [];
  private PHOTO_STORAGE = 'photos';

  constructor(private alertCtrl: AlertController) {}

  async addNewToGallery() {
    try {
      const capturedPhoto = await Camera.getPhoto({
        resultType: CameraResultType.Uri,
        source: CameraSource.Prompt,
        quality: 100,
      });

      const savedImageFile = await this.savePicture(capturedPhoto);
      this.photos.unshift(savedImageFile);

      await Preferences.set({
        key: this.PHOTO_STORAGE,
        value: JSON.stringify(this.photos),
      });
    } catch (error) {
      console.warn('Captura cancelada ou erro ao tirar foto:', error);
    }
  }

  async loadSaved() {
    const photoList = await Preferences.get({ key: this.PHOTO_STORAGE });
    this.photos = photoList.value ? JSON.parse(photoList.value) : [];

    for (let photo of this.photos) {
      try {
        const readFile = await Filesystem.readFile({
          path: photo.filepath,
          directory: Directory.Data,
        });
        photo.webviewPath = `data:image/jpeg;base64,${readFile.data}`;
      } catch (error) {
        console.warn('Erro ao ler foto:', photo.filepath, error);
      }
    }
  }

  async deletePicture(photo: UserPhoto, position: number) {
    const alert = await this.alertCtrl.create({
      header: 'Excluir foto',
      message: 'Tem certeza que deseja excluir esta foto?',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Excluir',
          handler: async () => {
            console.log('Deletando foto:', photo.filepath);

            
            this.photos = [
              ...this.photos.slice(0, position),
              ...this.photos.slice(position + 1),
            ];

           
            await Preferences.set({
              key: this.PHOTO_STORAGE,
              value: JSON.stringify(this.photos),
            });

            try {
              await Filesystem.deleteFile({
                path: photo.filepath,
                directory: Directory.Data,
              });
              console.log('Arquivo excluído com sucesso.');
            } catch (err) {
              console.error('Erro ao excluir arquivo:', err);
            }
          },
        },
      ],
    });

    await alert.present();
  }

  private async savePicture(photo: Photo): Promise<UserPhoto> {
    const base64Data = await this.readAsBase64(photo);
    const fileName = new Date().getTime() + '.jpeg';

    await Filesystem.writeFile({
      path: fileName,
      data: base64Data,
      directory: Directory.Data,
    });

    return {
      filepath: fileName,
      webviewPath: photo.webPath,
    };
  }

  private async readAsBase64(photo: Photo): Promise<string> {
    const response = await fetch(photo.webPath!);
    const blob = await response.blob();
    return await this.convertBlobToBase64(blob) as string;
  }

  private convertBlobToBase64 = (blob: Blob) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
}
