// 0x578640 Start_Rect6x6Check size=C9

bool __thiscall sub_578640(_DWORD *this, _DWORD *a2, __int16 *a3, char a4)
{
  int v4; // edx
  int v5; // esi
  int v6; // edi
  unsigned int v7; // eax
  _BYTE *v8; // eax
  int v9; // ebx
  int v10; // eax

  v4 = a3[1];
  v5 = 0;
  v6 = *a3;
  if ( a4 != 0 )
  {
    v7 = v6 + (v4 << 9);
    if ( v7 >= 0x40000 || (v8 = *(_BYTE **)(dword_87F924 + 4 * v7)) == nullptr )
    {
      dword_ABDC74 = *(_DWORD *)a3;
      v8 = &unk_ABDC50;
    }
    v5 = (char)v8[283];
    if ( v8[284] != 0 && v4 + v6 < v5 + *(this + 61) + 2 * a2[1] + 4 )
      ++v5;
  }
  v9 = a2[1];
  v10 = *(this + 61);
  return v4 + v6 > v5 + v10 + 2 * v9
      && v4 + v6 <= v5 + v10 + 2 * (v9 + a2[3]) + 2
      && v6 - v4 < 2 * (*a2 + a2[2]) - v10
      && v4 - v6 < v10 - 2 * *a2;
}
