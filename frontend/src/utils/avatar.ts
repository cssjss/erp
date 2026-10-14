function readAvatarFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '')
    reader.onerror = () => reject(new Error('头像读取失败。'))
    reader.readAsDataURL(file)
  })
}

export async function readAvatarFromInput(file: File | undefined) {
  if (!file) {
    return ''
  }

  if (!file.type.startsWith('image/')) {
    throw new Error('请上传图片格式的头像。')
  }

  if (file.size > 1024 * 1024) {
    throw new Error('头像大小不能超过 1MB。')
  }

  return readAvatarFile(file)
}
