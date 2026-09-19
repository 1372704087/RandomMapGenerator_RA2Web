// 0x56d230 Zone_GetZoneID size=16A

int __thiscall sub_56D230(_DWORD *this, __int16 *a2, int a3, char a4)
{
  __int16 *v4; // esi
  _DWORD *v5; // edi
  unsigned int v6; // eax
  _DWORD *v7; // eax
  int v8; // eax
  int v9; // ebx
  unsigned int v10; // eax
  _DWORD *v11; // eax
  _DWORD *v12; // edi
  unsigned int i; // esi
  int v14; // eax
  int v16; // ecx

  v4 = a2;
  v5 = this;
  if ( a4 != 0 )
  {
    v6 = *a2 + (a2[1] << 9);
    if ( v6 >= 0x40000 || (v7 = *(_DWORD **)(dword_87F924 + 4 * v6)) == nullptr )
    {
      dword_ABDC74 = *(_DWORD *)a2;
      v7 = &unk_ABDC50;
    }
    if ( (v7[80] & 0x100) != 0 )
    {
      v8 = sub_56DA10(a2, 1, 0);
      if ( v8 == -1 )
        return -1;
      v9 = 16 * v8 + v5[21];
      if ( *(_BYTE *)(v9 + 8) != 0 )
      {
        v4 = (__int16 *)(16 * v8 + v5[21]);
      }
      else
      {
        v10 = *a2 + (a2[1] << 9);
        if ( v10 < 0x40000 && (v11 = *(_DWORD **)(dword_87F924 + 4 * v10)) != nullptr )
        {
          v12 = v11;
        }
        else
        {
          v12 = &unk_ABDC50;
          dword_ABDC74 = *(_DWORD *)a2;
        }
        for ( i = *(_WORD *)(v9 + 4) != *(_WORD *)v9 ? 2 : 4; (v12[80] & 0x100) != 0; v12 = sub_481810(v12, i) )
          ;
        if ( ((unsigned __int8)sub_486750(v12) != 0 || (unsigned __int8)sub_486770(v12) != 0) && v12[59] != 3 )
          v4 = (__int16 *)(v9 + 4);
        else
          v4 = (__int16 *)v9;
        v5 = this;
      }
    }
  }
  v14 = *v4 + v4[1] * (v5[62] + v5[61] + 1);
  if ( v14 >= 0 )
  {
    v16 = v5[27];
    if ( v14 >= v16 )
      v14 = v16 - 1;
  }
  else
  {
    v14 = 0;
  }
  return *(unsigned __int16 *)(v5[a3 + 6] + 2 * *(unsigned __int16 *)(v5[26] + 4 * v14 + 2));
}
