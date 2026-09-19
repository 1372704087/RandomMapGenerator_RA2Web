// 0x58e5d0 Region_BorderCells size=161

_DWORD *__thiscall sub_58E5D0(_DWORD *this)
{
  _DWORD *v1; // ebx
  _DWORD *v2; // esi
  _DWORD *v3; // ebp
  int v4; // eax
  int v5; // eax
  int v6; // edi
  int v7; // esi
  int v8; // ebx
  int v9; // edx
  __int16 v10; // cx
  int v11; // edx
  int v12; // eax
  int v13; // ecx
  int v14; // eax
  int v15; // ecx
  int v16; // eax
  int v17; // eax
  int v18; // edx
  _DWORD *v20; // [esp+Ch] [ebp-10h]
  int v21; // [esp+10h] [ebp-Ch]

  v1 = this;
  v2 = operator new(0x18u);
  v3 = nullptr;
  if ( v2 != nullptr )
  {
    sub_42FCB0(0, 0);
    v2[4] = 0;
    *v2 = &DynamicVectorClass<Cell>::`vftable';
    v2[5] = 10;
    v3 = v2;
  }
  v20 = v3;
  v4 = v1[3] / 2;
  if ( v4 < 10 )
    v4 = 10;
  v3[5] = v4;
  v5 = v1[14] - 1;
  v21 = v5;
  if ( v5 < 0 )
    return v3;
  v6 = dword_ABED04;
  while ( 2 )
  {
    v7 = 0;
    v8 = *(_DWORD *)(v1[11] + 4 * v5);
    while ( 1 )
    {
      v9 = v7 & 7;
      v10 = HIWORD(v8) + HIWORD(dword_89F688[v9]);
      v11 = (__int16)(v8 + LOWORD(dword_89F688[v9]));
      v12 = v10;
      v13 = v10 + v11;
      if ( v13 > v6 )
        break;
LABEL_18:
      if ( ++v7 >= 8 )
        goto LABEL_27;
    }
    if ( v11 - v12 >= v6
      || v12 - v11 >= v6
      || v13 > dword_ABED08
      || (dword_ABED10 != nullptr
        ? (v14 = *((_DWORD *)dword_ABED10 + 20 * v11 + 20 * dword_89C2DC * v12 + 14))
        : (v14 = -1),
          v14 == *(this + 2)) )
    {
      v3 = v20;
      goto LABEL_18;
    }
    v3 = v20;
    v15 = v20[2];
    if ( v20[4] < v15 )
      goto LABEL_25;
    if ( *((_BYTE *)v20 + 13) != 0 || v15 == 0 )
    {
      v16 = v20[5];
      if ( v16 > 0 )
      {
        if ( (*(unsigned __int8 (__thiscall **)(_DWORD *, int, _DWORD))(*v20 + 8))(v20, v15 + v16, 0) != 0 )
        {
LABEL_25:
          v17 = v20[4];
          v18 = v20[1];
          v20[4] = v17 + 1;
          *(_DWORD *)(v18 + 4 * v17) = v8;
        }
        v6 = dword_ABED04;
      }
    }
LABEL_27:
    if ( --v21 >= 0 )
    {
      v5 = v21;
      v1 = this;
      continue;
    }
    return v3;
  }
}
