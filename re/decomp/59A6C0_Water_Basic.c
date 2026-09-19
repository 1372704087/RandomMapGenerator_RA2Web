// 0x59a6c0 Water_Basic size=221

int __thiscall sub_59A6C0(int *this)
{
  int i; // eax
  int v3; // eax
  int v4; // eax
  int j; // edi
  char v6; // bl
  int k; // esi
  _DWORD *v8; // eax
  int v9; // ecx
  int v10; // eax
  int m; // ebx
  _DWORD *v12; // esi
  int v13; // eax
  void *v14; // eax
  int result; // eax
  int n; // ebp
  int ii; // esi
  _DWORD *v18; // edi
  _DWORD *v19; // [esp+10h] [ebp-4h] BYREF

  sub_578350(&stru_87F7E8);
  for ( i = sub_578290(&stru_87F7E8); i != 0; i = sub_578290(&stru_87F7E8) )
    *(_DWORD *)(i + 56) = dword_AA0738;
  v3 = *(this + 15);
  if ( v3 != 0 )
  {
    v4 = v3 - 1;
    if ( v4 != 0 )
    {
      if ( v4 == 1 )
        sub_59B200(this);
    }
    else
    {
      sub_59AFA0((int)this);
    }
  }
  else
  {
    sub_59AD10(this);
  }
  sub_578350(&stru_87F7E8);
  for ( j = sub_578290(&stru_87F7E8); j != 0; j = sub_578290(&stru_87F7E8) )
  {
    if ( *(_DWORD *)(j + 56) == dword_AA0738 )
    {
      v6 = 1;
      for ( k = 0; k < 8; k += 2 )
      {
        v8 = (_DWORD *)sub_481810(k);
        if ( !sub_486380(v8) )
          v6 = 0;
      }
      if ( v6 != 0 )
        *(_DWORD *)(j + 56) = 0;
    }
  }
  sub_57A0C0(0, 0);
  if ( dword_ABED10 != nullptr )
  {
    v9 = dword_89C2DC * dword_89C2DC;
    if ( dword_89C2DC * dword_89C2DC > 0 )
    {
      v10 = 0;
      do
      {
        *(_DWORD *)((char *)dword_ABED10 + v10 + 56) = -1;
        *(_DWORD *)((char *)dword_ABED10 + v10 + 60) = -1;
        v10 += 80;
        --v9;
      }
      while ( v9 != 0 );
    }
  }
  for ( m = dword_ABDFA0 - 1; m >= 0; --m )
  {
    v12 = *((_DWORD **)dword_ABDF94 + m);
    if ( v12 != nullptr )
    {
      if ( *v12 != 0 )
      {
        (**(void (__thiscall ***)(_DWORD, int))*v12)(*v12, 1);
        *v12 = 0;
      }
      v19 = v12;
      v13 = (*(int (__thiscall **)(int *, _DWORD **))(dword_ABDF90 + 16))(&dword_ABDF90, &v19);
      if ( v13 != -1 && v13 < dword_ABDFA0 && v13 < --dword_ABDFA0 )
      {
        do
        {
          ++v13;
          *((_DWORD *)dword_ABDF94 + v13 - 1) = *((_DWORD *)dword_ABDF94 + v13);
        }
        while ( v13 < dword_ABDFA0 );
      }
      v14 = (void *)v12[11];
      v12[10] = &VectorClass<Cell>::`vftable';
      if ( v14 != nullptr && *((_BYTE *)v12 + 53) != 0 )
      {
        operator delete(v14);
        v12[11] = 0;
      }
      *((_BYTE *)v12 + 53) = 0;
      v12[12] = 0;
      operator delete(v12);
    }
  }
  dword_ABED14 = 0;
  sub_578350(&stru_87F7E8);
  result = sub_578290(&stru_87F7E8);
  for ( n = result; result != 0; n = result )
  {
    if ( (unsigned __int8)sub_4865B0(n) != 0 )
    {
      for ( ii = 0; ii < 8; ii += 2 )
      {
        v18 = (_DWORD *)sub_481810(ii);
        if ( sub_486380(v18) )
          v18[14] = dword_AA0E18;
      }
    }
    result = sub_578290(&stru_87F7E8);
  }
  return result;
}
