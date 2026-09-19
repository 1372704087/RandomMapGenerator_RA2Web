// 0x58f0c0 Bridge_Helper size=1FF

void __thiscall sub_58F0C0(_DWORD *this)
{
  _DWORD *v1; // ebx
  _DWORD *v2; // esi
  _BYTE *v3; // ecx
  signed int v4; // eax
  int v5; // ebp
  int v6; // eax
  int v7; // esi
  int v8; // edi
  int v9; // ebp
  int v10; // edx
  __int16 v11; // cx
  int v12; // edx
  int v13; // eax
  int v14; // ecx
  int v15; // eax
  signed int i; // edi
  int v17; // esi
  int v18; // ecx
  int v19; // eax
  int v20; // eax
  int v21; // edx
  int v22; // eax
  int v23; // ecx
  int v24; // esi
  char *v25; // edx
  _BYTE *Block; // [esp+10h] [ebp-14h]
  int v27; // [esp+14h] [ebp-10h]
  int v28; // [esp+1Ch] [ebp-8h]

  v1 = this;
  v2 = operator new(0x18u);
  if ( v2 != nullptr )
  {
    sub_477BE0(0, 0);
    *v2 = &DynamicVectorClass<int>::`vftable';
    v2[5] = 10;
    v2[4] = 0;
  }
  else
  {
    v2 = nullptr;
  }
  v1[1] = v2;
  v3 = operator new(dword_ABED14);
  v4 = 0;
  for ( Block = v3; v4 < (int)dword_ABED14; ++v4 )
    v3[v4] = 0;
  v5 = sub_58D410(v1);
  v6 = 0;
  v28 = v5;
  v27 = 0;
  if ( *(int *)(v5 + 16) > 0 )
  {
    v7 = dword_ABED04;
    do
    {
      v8 = 0;
      v9 = *(_DWORD *)(*(_DWORD *)(v5 + 4) + 4 * v6);
      do
      {
        v10 = v8 & 7;
        v11 = HIWORD(v9) + HIWORD(dword_89F688[v10]);
        v12 = (__int16)(v9 + LOWORD(dword_89F688[v10]));
        v13 = v11;
        v14 = v11 + v12;
        if ( v14 > v7 && v12 - v13 < v7 && v13 - v12 < v7 && v14 <= dword_ABED08 && dword_ABED10 != nullptr )
        {
          v15 = *((_DWORD *)dword_ABED10 + 20 * v12 + 20 * dword_89C2DC * v13 + 14);
          if ( v15 >= 0 )
          {
            Block[v15] = 1;
            v7 = dword_ABED04;
          }
        }
        ++v8;
      }
      while ( v8 < 8 );
      v5 = v28;
      v6 = v27 + 1;
      v27 = v6;
    }
    while ( v6 < *(_DWORD *)(v28 + 16) );
    v1 = this;
  }
  for ( i = 0; i < (int)dword_ABED14; ++i )
  {
    if ( Block[i] != 0 && i != v1[2] )
    {
      v17 = v1[1];
      v18 = *(_DWORD *)(v17 + 8);
      if ( *(_DWORD *)(v17 + 16) < v18
        || (*(_BYTE *)(v17 + 13) != 0 || v18 == 0)
        && (v19 = *(_DWORD *)(v17 + 20)) > 0
        && (*(unsigned __int8 (__thiscall **)(int, int, _DWORD))(*(_DWORD *)v17 + 8))(v17, v18 + v19, 0) != 0 )
      {
        v20 = *(_DWORD *)(v17 + 16);
        v21 = *(_DWORD *)(v17 + 4);
        *(_DWORD *)(v17 + 16) = v20 + 1;
        *(_DWORD *)(v21 + 4 * v20) = i;
      }
    }
  }
  v22 = 0;
  v1[3] = 0;
  v23 = dword_89C2DC * dword_89C2DC;
  if ( dword_89C2DC * dword_89C2DC > 0 )
  {
    v24 = v1[2];
    v25 = (char *)dword_ABED10;
    do
    {
      if ( *(_DWORD *)&v25[v22 + 56] == v24 && (*(_WORD *)&v25[v22] != 0 || *(_WORD *)&v25[v22 + 2] != 0) )
      {
        ++v1[3];
        v25 = (char *)dword_ABED10;
      }
      v22 += 80;
      --v23;
    }
    while ( v23 != 0 );
  }
  if ( v5 != 0 )
    (**(void (__thiscall ***)(int, int))v5)(v5, 1);
  operator delete(Block);
}
