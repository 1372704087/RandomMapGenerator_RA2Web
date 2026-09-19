// 0x5657a0 DiamondToCell size=38

void *__thiscall sub_5657A0(_DWORD *this, __int16 *a2)
{
  unsigned int v2; // eax
  void *result; // eax

  v2 = *a2 + (a2[1] << 9);
  if ( v2 >= 0x40000 || (result = *(void **)(*(this + 79) + 4 * v2)) == nullptr )
  {
    dword_ABDC74 = *(_DWORD *)a2;
    return &unk_ABDC50;
  }
  return result;
}
